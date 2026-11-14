const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    description: {
        type: String,
        required: [true, 'Item description is required'],
        trim: true
    },
    quantity: {
        type: Number,
        default: 1,
        min: [1, 'Quantity must be at least 1']
    },
    unitPrice: {
        type: Number,
        default: function () {
            return this.cost;
        }
    },
    cost: {
        type: Number,
        required: [true, 'Cost is required'],
        min: [0, 'Cost cannot be negative']
    }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',
        required: true,
        index: true
    },
    invoiceNumber: {
        type: String,
        unique: true,
        required: true
    },
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: false
    },
    patientName: {
        type: String,
        required: [true, 'Patient name is required'],
        trim: true
    },
    appointmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Appointment'
    },
    items: {
        type: [invoiceItemSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length > 0;
            },
            message: 'Invoice must have at least one line item'
        }
    },
    subtotal: {
        type: Number,
        required: true,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    discount: {
        type: Number,
        default: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Paid', 'Cancelled'],
        default: 'Pending',
        index: true
    },
    paymentDetails: {
        method: {
            type: String,
            enum: ['Card', 'UPI', 'NetBanking', 'Cash', 'Sandbox Simulation', 'Other']
        },
        transactionId: String,
        paidAt: Date,
        gateway: {
            type: String,
            default: 'ZenoCare Sandbox Gateway'
        },
        amountPaid: Number
    },
    date: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

invoiceSchema.index({ hospitalId: 1, date: -1 });
invoiceSchema.index({ hospitalId: 1, status: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
