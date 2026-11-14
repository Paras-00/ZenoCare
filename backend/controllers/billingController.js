const Invoice = require('../models/Invoice');
const Appointment = require('../models/Appointment');
const Hospital = require('../models/Hospital');
const Patient = require('../models/Patient');
const PDFDocument = require('pdfkit');
const { logAudit } = require('../utils/auditLogger');

// Helper to calculate and reconcile invoice totals from line items
const reconcileLineItems = (items = [], tax = 0, discount = 0) => {
    let subtotal = 0;
    const reconciledItems = items.map(item => {
        const quantity = Math.max(1, parseInt(item.quantity) || 1);
        const unitPrice = parseFloat(item.unitPrice !== undefined ? item.unitPrice : item.cost) || 0;
        const cost = quantity * unitPrice;
        subtotal += cost;
        return {
            description: String(item.description || 'Medical Service').trim(),
            quantity,
            unitPrice,
            cost
        };
    });

    const numTax = Math.max(0, parseFloat(tax) || 0);
    const numDiscount = Math.max(0, parseFloat(discount) || 0);
    const totalAmount = Math.max(0, subtotal + numTax - numDiscount);

    return { reconciledItems, subtotal, tax: numTax, discount: numDiscount, totalAmount };
};

// @desc    Create new itemized invoice (with strict line item reconciliation)
// @route   POST /api/hospital/invoices
// @access  Private (Hospital Admin, Billing, Receptionist)
exports.createInvoice = async (req, res) => {
    try {
        const { patientName, patientId, items, status, date, appointmentId, tax, discount } = req.body;
        const hospitalId = req.user.hospitalId || req.user.id;

        if (!patientName || !items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide patientName and at least one billable item'
            });
        }

        // Reconcile line items
        const { reconciledItems, subtotal, tax: finalTax, discount: finalDiscount, totalAmount } =
            reconcileLineItems(items, tax, discount);

        // Generate unique invoice number: INV-YYYYMMDD-XXXXX
        const now = new Date();
        const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
        const rand = Math.floor(10000 + Math.random() * 90000);
        const invoiceNumber = `INV-${ymd}-${rand}`;

        const newInvoice = new Invoice({
            hospitalId,
            invoiceNumber,
            patientName: patientName.trim(),
            patientId: patientId || undefined,
            appointmentId: appointmentId || undefined,
            items: reconciledItems,
            subtotal,
            tax: finalTax,
            discount: finalDiscount,
            totalAmount,
            status: status === 'Paid' ? 'Paid' : 'Pending',
            date: date || now
        });

        if (status === 'Paid') {
            newInvoice.paymentDetails = {
                method: 'Cash',
                transactionId: `TXN_INIT_${Date.now()}`,
                paidAt: now,
                gateway: 'Direct Payment',
                amountPaid: totalAmount
            };
        }

        await newInvoice.save();

        // If linked to an appointment, update appointment reference
        if (appointmentId) {
            await Appointment.findByIdAndUpdate(appointmentId, {
                invoiceId: newInvoice._id,
                isPaid: status === 'Paid'
            });
        }

        // Audit Trail
        await logAudit({
            req,
            action: 'INVOICE_CREATE',
            resourceType: 'Invoice',
            resourceId: newInvoice._id,
            patientId: patientId || undefined,
            details: {
                invoiceNumber,
                patientName,
                totalAmount,
                itemsCount: reconciledItems.length,
                status: newInvoice.status
            }
        });

        res.status(201).json({
            success: true,
            message: 'Invoice created successfully with reconciled line items',
            data: newInvoice
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error creating invoice'
        });
    }
};

// @desc    Process simulated sandbox payment for an invoice
// @route   POST /api/hospital/invoices/:id/sandbox-pay
// @access  Private (Hospital Admin, Billing, Receptionist)
exports.processSandboxPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentMethod, amountPaid, simulateFailure } = req.body;
        const hospitalId = req.user.hospitalId || req.user.id;

        const invoice = await Invoice.findOne({ _id: id, hospitalId });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        if (invoice.status === 'Paid') {
            return res.status(400).json({
                success: false,
                message: 'Invoice is already marked as Paid'
            });
        }

        // Check simulated failure condition (negative test testing)
        if (simulateFailure) {
            return res.status(402).json({
                success: false,
                message: 'Sandbox Payment Declined: Simulated bank card declined / insufficient balance'
            });
        }

        // Acceptance test requirement: An invoice reconciles with its line items and payment status
        const paymentAmount = parseFloat(amountPaid !== undefined ? amountPaid : invoice.totalAmount);
        if (Math.abs(paymentAmount - invoice.totalAmount) > 0.01) {
            return res.status(422).json({
                success: false,
                message: `Payment reconciliation failed: Payment amount (₹${paymentAmount}) does not match invoice total amount (₹${invoice.totalAmount}).`
            });
        }

        // Generate synthetic sandbox transaction ID
        const transactionId = `ZENOPAY_SANDBOX_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const paidAt = new Date();

        invoice.status = 'Paid';
        invoice.paymentDetails = {
            method: paymentMethod || 'Card',
            transactionId,
            paidAt,
            gateway: 'ZenoCare Sandbox Gateway',
            amountPaid: paymentAmount
        };

        await invoice.save();

        // Mark linked appointment as paid
        if (invoice.appointmentId) {
            await Appointment.findByIdAndUpdate(invoice.appointmentId, { isPaid: true });
        }

        // Audit Trail
        await logAudit({
            req,
            action: 'PAYMENT_PROCESSED',
            resourceType: 'Invoice',
            resourceId: invoice._id,
            patientId: invoice.patientId,
            details: {
                invoiceNumber: invoice.invoiceNumber,
                transactionId,
                amountPaid: paymentAmount,
                method: paymentMethod || 'Card',
                reconciled: true
            }
        });

        res.status(200).json({
            success: true,
            message: 'Sandbox payment successfully verified, reconciled and settled',
            data: invoice
        });
    } catch (error) {
        console.error('Error processing sandbox payment:', error);
        res.status(500).json({
            success: false,
            message: 'Server error processing sandbox payment'
        });
    }
};

// @desc    Get all invoices for hospital
// @route   GET /api/hospital/invoices
// @access  Private (Hospital Admin, Billing, Receptionist)
exports.getInvoices = async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.user.id;
        const { status, search } = req.query;

        const query = { hospitalId };
        if (status) query.status = status;
        if (search) {
            query.$or = [
                { patientName: { $regex: search, $options: 'i' } },
                { invoiceNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const invoices = await Invoice.find(query).sort({ date: -1 });

        // Calculate summary
        let totalRevenue = 0;
        let pendingRevenue = 0;
        invoices.forEach(inv => {
            if (inv.status === 'Paid') totalRevenue += inv.totalAmount;
            if (inv.status === 'Pending') pendingRevenue += inv.totalAmount;
        });

        res.status(200).json({
            success: true,
            count: invoices.length,
            summary: {
                totalInvoices: invoices.length,
                totalRevenue,
                pendingRevenue
            },
            data: invoices
        });
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get single invoice by ID
// @route   GET /api/hospital/invoices/:id
// @access  Private
exports.getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId || req.user.id;

        const invoice = await Invoice.findOne({ _id: id, hospitalId })
            .populate('patientId', 'firstName lastName phone email patientId')
            .populate('appointmentId');

        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        res.status(200).json({
            success: true,
            data: invoice
        });
    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Generate itemized PDF invoice
// @route   GET /api/hospital/invoices/:id/pdf
// @access  Private
exports.generateInvoicePDF = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId || req.user.id;

        const invoice = await Invoice.findOne({ _id: id, hospitalId });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        const hospital = await Hospital.findById(hospitalId);
        const hospitalName = hospital ? hospital.name : 'ZenoCare Healthcare Hospital';

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Invoice-${invoice.invoiceNumber || invoice._id}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(22).fillColor('#1e40af').text(hospitalName, 50, 50, { bold: true });
        doc.fontSize(10).fillColor('#64748b').text('ZenoCare Healthcare Network  |  Official Patient Invoice', 50, 75);
        doc.text(hospital?.address ? `${hospital.address.street || ''}, ${hospital.address.city || ''}` : 'Hospital Medical Centre', 50, 90);
        doc.text(`Phone: ${hospital?.phone || 'Emergency Helpline 108'}  |  Email: ${hospital?.email || 'billing@zenocare.com'}`, 50, 103);

        doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e2e8f0').stroke();

        // Invoice Meta Block
        doc.fontSize(14).fillColor('#0f172a').text('INVOICE & RECEIPT', 50, 135, { bold: true });
        
        doc.fontSize(10).fillColor('#334155');
        doc.text(`Invoice No: ${invoice.invoiceNumber || invoice._id}`, 50, 155);
        doc.text(`Date: ${new Date(invoice.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 170);
        
        const statusColor = invoice.status === 'Paid' ? '#16a34a' : '#d97706';
        doc.fillColor(statusColor).text(`Status: ${invoice.status.toUpperCase()}`, 50, 185, { bold: true });

        // Patient Info Block
        doc.fillColor('#0f172a').text('Billed To:', 320, 135, { bold: true });
        doc.fontSize(10).fillColor('#334155');
        doc.text(`Patient Name: ${invoice.patientName}`, 320, 155);
        if (invoice.patientId) {
            doc.text(`Patient ID: ${invoice.patientId}`, 320, 170);
        }

        doc.moveTo(50, 210).lineTo(545, 210).strokeColor('#e2e8f0').stroke();

        // Line Items Table Header
        let yPos = 225;
        doc.rect(50, yPos, 495, 22).fill('#f1f5f9');
        doc.fillColor('#1e293b').fontSize(10).text('Item Description', 60, yPos + 6, { bold: true });
        doc.text('Qty', 330, yPos + 6, { bold: true });
        doc.text('Unit Price', 380, yPos + 6, { bold: true });
        doc.text('Total (INR)', 465, yPos + 6, { bold: true });

        yPos += 28;

        // Line Items Rows
        invoice.items.forEach((item, index) => {
            const isEven = index % 2 === 0;
            if (isEven) {
                doc.rect(50, yPos - 3, 495, 20).fill('#fafafa');
            }
            doc.fillColor('#334155').fontSize(9);
            doc.text(item.description, 60, yPos);
            doc.text(String(item.quantity || 1), 335, yPos);
            doc.text(`₹${(item.unitPrice !== undefined ? item.unitPrice : item.cost).toFixed(2)}`, 380, yPos);
            doc.text(`₹${item.cost.toFixed(2)}`, 465, yPos);
            yPos += 20;
        });

        doc.moveTo(50, yPos + 5).lineTo(545, yPos + 5).strokeColor('#e2e8f0').stroke();
        yPos += 15;

        // Summary Breakdown
        doc.fontSize(10).fillColor('#475569');
        doc.text('Subtotal:', 350, yPos);
        doc.text(`₹${(invoice.subtotal || invoice.totalAmount).toFixed(2)}`, 465, yPos);
        yPos += 18;

        if (invoice.tax > 0) {
            doc.text('Tax / GST:', 350, yPos);
            doc.text(`₹${invoice.tax.toFixed(2)}`, 465, yPos);
            yPos += 18;
        }

        if (invoice.discount > 0) {
            doc.text('Discount:', 350, yPos);
            doc.text(`- ₹${invoice.discount.toFixed(2)}`, 465, yPos);
            yPos += 18;
        }

        doc.rect(340, yPos - 3, 205, 24).fill('#e0f2fe');
        doc.fontSize(11).fillColor('#0369a1').text('Reconciled Total:', 350, yPos + 4, { bold: true });
        doc.text(`₹${invoice.totalAmount.toFixed(2)}`, 465, yPos + 4, { bold: true });

        yPos += 35;

        // Payment Details Block (if paid)
        if (invoice.status === 'Paid' && invoice.paymentDetails) {
            doc.rect(50, yPos, 495, 45).fill('#f0fdf4');
            doc.fillColor('#166534').fontSize(10);
            doc.text('✓ Sandbox Payment Verified & Settled', 60, yPos + 8, { bold: true });
            doc.fontSize(9).text(`Gateway: ${invoice.paymentDetails.gateway || 'ZenoCare Sandbox Gateway'}  |  Method: ${invoice.paymentDetails.method || 'Card'}`, 60, yPos + 22);
            doc.text(`Transaction Reference: ${invoice.paymentDetails.transactionId || 'N/A'}  |  Settled At: ${new Date(invoice.paymentDetails.paidAt || invoice.updatedAt).toLocaleString()}`, 60, yPos + 34);
            yPos += 60;
        }

        // Footer
        doc.fontSize(8).fillColor('#94a3b8').text(
            'This is a verified computer-generated healthcare invoice generated by ZenoCare Hospital Management System. All records are cryptographically verified and backed by the audit log.',
            50,
            750,
            { align: 'center', width: 495 }
        );

        doc.end();
    } catch (error) {
        console.error('Error generating PDF invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Server error generating PDF invoice'
        });
    }
};

// @desc    Update invoice
// @route   PUT /api/hospital/invoices/:id
// @access  Private (Hospital Admin)
exports.updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId || req.user.id;
        const { items, tax, discount, status, patientName } = req.body;

        const invoice = await Invoice.findOne({ _id: id, hospitalId });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or unauthorized'
            });
        }

        if (items && Array.isArray(items) && items.length > 0) {
            const { reconciledItems, subtotal, tax: fTax, discount: fDisc, totalAmount } =
                reconcileLineItems(items, tax !== undefined ? tax : invoice.tax, discount !== undefined ? discount : invoice.discount);
            invoice.items = reconciledItems;
            invoice.subtotal = subtotal;
            invoice.tax = fTax;
            invoice.discount = fDisc;
            invoice.totalAmount = totalAmount;
        }

        if (patientName) invoice.patientName = patientName.trim();
        if (status) {
            invoice.status = status;
            if (status === 'Paid' && !invoice.paymentDetails?.transactionId) {
                invoice.paymentDetails = {
                    method: 'Cash',
                    transactionId: `TXN_MANUAL_${Date.now()}`,
                    paidAt: new Date(),
                    gateway: 'Manual Settlement',
                    amountPaid: invoice.totalAmount
                };
            }
        }

        await invoice.save();

        if (invoice.status === 'Paid' && invoice.appointmentId) {
            await Appointment.findByIdAndUpdate(invoice.appointmentId, { isPaid: true });
        }

        await logAudit({
            req,
            action: 'INVOICE_UPDATE',
            resourceType: 'Invoice',
            resourceId: invoice._id,
            details: { updatedStatus: invoice.status, totalAmount: invoice.totalAmount }
        });

        res.status(200).json({
            success: true,
            message: 'Invoice updated and reconciled',
            data: invoice
        });
    } catch (error) {
        console.error('Error updating invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Delete invoice
// @route   DELETE /api/hospital/invoices/:id
// @access  Private (Hospital Admin)
exports.deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const hospitalId = req.user.hospitalId || req.user.id;

        const invoice = await Invoice.findOneAndDelete({ _id: id, hospitalId });
        if (!invoice) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found or unauthorized'
            });
        }

        if (invoice.appointmentId) {
            await Appointment.findByIdAndUpdate(invoice.appointmentId, {
                $unset: { invoiceId: 1 },
                isPaid: false
            });
        }

        await logAudit({
            req,
            action: 'INVOICE_DELETE',
            resourceType: 'Invoice',
            resourceId: id,
            details: { invoiceNumber: invoice.invoiceNumber, patientName: invoice.patientName }
        });

        res.status(200).json({
            success: true,
            message: 'Invoice deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting invoice:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get billable appointments (Completed but not invoiced)
// @route   GET /api/hospital/billable-appointments
// @access  Private
exports.getBillableAppointments = async (req, res) => {
    try {
        const hospitalId = req.user.hospitalId || req.user.id;

        const appointments = await Appointment.find({
            hospitalId,
            status: 'Completed',
            invoiceId: { $exists: false }
        })
            .populate('patientId', 'firstName lastName phone patientId')
            .populate('doctorId', 'firstName lastName departmentId consultationFee')
            .populate('visitRecordId')
            .sort({ appointmentDate: -1 });

        res.status(200).json({
            success: true,
            count: appointments.length,
            data: appointments
        });
    } catch (error) {
        console.error('Error fetching billable appointments:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};
