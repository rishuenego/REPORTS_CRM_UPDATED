import express from "express";
import { pgPool } from "../index.js";

const router = express.Router();

const getBranchId = (branch) => {
  const branchMap = { AHM: 1, NOIDA: 2, CHENNAI: 3 };
  return branchMap[branch.toUpperCase()];
};

// Get contacts by branch
router.get("/contacts/:branch", async (req, res) => {
  try {
    const { branch } = req.params;
    const branchId = getBranchId(branch);

    if (!branchId) {
      return res.status(400).json({ error: "Invalid branch" });
    }

    const pgConnection = await pgPool.connect();

    const { rows: contacts } = await pgConnection.query(
      `
      SELECT 
        name,
        work_phone,
        CASE 
          WHEN branch_id = 1 THEN 'AHM'
          WHEN branch_id = 2 THEN 'NOIDA'
          WHEN branch_id = 3 THEN 'CHENNAI'
          ELSE 'UNKNOWN'
        END AS branch
      FROM public.hr_employee
      WHERE branch_id = $1
      ORDER BY id ASC
    `,
      [branchId]
    );

    pgConnection.release();

    res.json({
      branch,
      contacts,
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: error.message });
  }
});

// Send message to contacts
router.post("/send", async (req, res) => {
  try {
    const { fromNumber, message, contacts } = req.body;

    if (!fromNumber || !message || !contacts || contacts.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Log the message broadcast details
    console.log("Message Broadcast Request:", {
      from: fromNumber,
      message,
      recipientCount: contacts.length,
      recipients: contacts.map((c) => ({
        name: c.name,
        phone: c.work_phone,
        branch: c.branch,
      })),
    });

    // Here you would integrate with your SMS/messaging service
    // For now, we'll simulate a successful send

    // Example: You could add code here to integrate with Twilio, MSG91, etc.
    // const twilioClient = twilio(accountSid, authToken);
    // for (const contact of contacts) {
    //   await twilioClient.messages.create({
    //     body: message,
    //     from: fromNumber,
    //     to: contact.work_phone
    //   });
    // }

    res.json({
      success: true,
      message: `Message sent to ${contacts.length} contacts`,
      details: {
        from: fromNumber,
        recipientCount: contacts.length,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
