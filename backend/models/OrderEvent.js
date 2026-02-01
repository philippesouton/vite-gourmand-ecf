const mongoose = require("mongoose");

const OrderEventSchema = new mongoose.Schema(
  {
    menuId: { type: Number, required: true },
    persons: { type: Number, required: true },
    priceMin: { type: Number, required: true },
    theme: { type: String, required: true },
    diet: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.OrderEvent || mongoose.model("OrderEvent", OrderEventSchema);
