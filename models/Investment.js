const mongoose = require("mongoose");

const InvestmentSchema = new mongoose.Schema({
    projectName: { type: String, required: true },
    amountInvested: { type: Number, required: true },
    energyGenerated: { type: Number, required: true },
    returns: { type: Number, required: true },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Investment", InvestmentSchema);
