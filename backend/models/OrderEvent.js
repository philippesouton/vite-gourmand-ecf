const mongoose = require("mongoose");

const OrderEventSchema = new mongoose.Schema(
  {
    menuId: Number,
    persons: Number,
    priceMin: Number,
    theme: String,
    diet: String
  },
  { timestamps: true }
);

module.exports = mongoose.models.OrderEvent || mongoose.model("OrderEvent", OrderEventSchema);
