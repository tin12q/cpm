const Contact = require("../models/contact.model");
const Project = require("../models/project.model");

function escapeRegex(input = "") {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildContactPayload(body = {}) {
  return {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    type: String(body.type || "personal").trim().toLowerCase(),
    customer_name: String(body.customer_name || body.customerName || "").trim(),
    company_name: String(body.company_name || body.companyName || "").trim(),
    position: String(body.position || "").trim(),
    notes: String(body.notes || "").trim(),
    linked_user: body.linked_user || body.linkedUser || null,
  };
}

const listContacts = async (req, res) => {
  try {
    const pageRaw = parseInt(req.query.page, 10);
    const limitRaw = parseInt(req.query.limit, 10);
    const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;
    const limit = Number.isNaN(limitRaw) ? 20 : Math.max(limitRaw, 0);
    const skip = limit > 0 ? (page - 1) * limit : 0;
    const filter = {};

    if (req.query.type) {
      filter.type = String(req.query.type).trim().toLowerCase();
    }
    if (req.query.customer) {
      filter.customer_name = { $regex: `^${escapeRegex(req.query.customer)}$`, $options: "i" };
    }
    if (req.query.search) {
      const pattern = { $regex: escapeRegex(req.query.search), $options: "i" };
      filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }, { company_name: pattern }];
    }

    const query = Contact.find(filter).sort({ updatedAt: -1, name: 1 });
    const contacts = limit > 0 ? await query.limit(limit).skip(skip) : await query;
    const total = await Contact.countDocuments(filter);

    res.json({
      items: contacts,
      page,
      limit,
      total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getContactById = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const createContact = async (req, res) => {
  try {
    const payload = buildContactPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "Contact name is required" });
    }
    if (!Contact.TYPES.includes(payload.type)) {
      return res.status(400).json({ error: `Contact type must be one of: ${Contact.TYPES.join(", ")}` });
    }

    const created = await Contact.create(payload);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const updates = buildContactPayload(req.body);

    if (req.body.type !== undefined && !Contact.TYPES.includes(updates.type)) {
      return res.status(400).json({ error: `Contact type must be one of: ${Contact.TYPES.join(", ")}` });
    }

    Object.keys(updates).forEach((key) => {
      if (req.body[key] === undefined && req.body[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] === undefined) {
        delete updates[key];
      }
    });

    const updated = await Contact.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: "Contact not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const deleted = await Contact.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Contact not found" });
    }
    await Project.updateMany({ contacts: deleted._id }, { $pull: { contacts: deleted._id } });
    await Project.updateMany({ primary_contact: deleted._id }, { $set: { primary_contact: null } });
    res.json({ message: "Contact deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
};
