const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../helpers/roleValidator");
const {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
} = require("../controller/ContactController");

router.get("/", authenticate, requireRole({ collection: 0, task: 0 }), listContacts);
router.get("/:id", authenticate, requireRole({ collection: 0, task: 0 }), getContactById);
router.post("/", authenticate, requireRole({ collection: 0, task: 1 }), createContact);
router.put("/:id", authenticate, requireRole({ collection: 0, task: 2 }), updateContact);
router.delete("/:id", authenticate, requireRole({ collection: 0, task: 3 }), deleteContact);

module.exports = router;
