const mongoose = require("mongoose");

const CONTACT_TYPES = ["customer", "personal", "company", "employee"];

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    type: {
      type: String,
      enum: CONTACT_TYPES,
      default: "personal",
    },
    customer_name: { type: String, trim: true, default: "" },
    company_name: { type: String, trim: true, default: "" },
    position: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    linked_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },
  },
  { timestamps: true }
);

const Contact = mongoose.model("contacts", contactSchema);
Contact.TYPES = CONTACT_TYPES;

module.exports = Contact;
