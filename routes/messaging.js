import express from "express";
import { mysqlPool, pgPool } from "../index.js";
import fetch from "node-fetch";

const router = express.Router();

const WHATSAPP_API_TOKEN = "brUZgTDr6L";

const formatPhoneNumber = (number) => {
  if (!number) return null;
  let num = number.toString().trim();
  num = num.replace(/[^0-9+]/g, "");
  if (num.startsWith("+91")) return num;
  if (num.startsWith("91") && num.length > 10) return `+${num}`;
  if (num.length === 10) return `+91${num}`;
  return num;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getWhatsAppApiUrl = () => {
  return (
    process.env.WHATSAPP_API_URL ||
    "https://api-ping.blutec.ai/api/whatsapp/send-bulk-message"
  );
};

router.get("/birthdays/all", async (req, res) => {
  let pgConnection = null;

  try {
    pgConnection = await pgPool.connect();

    const { rows } = await pgConnection.query(`
      SELECT 
        name AS employee_name,
        birthday AS date_of_birth,
        CASE 
          WHEN TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE, 'MM-DD') THEN true
          ELSE false
        END AS is_today,
        CASE 
          WHEN TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'MM-DD') THEN true
          ELSE false
        END AS is_tomorrow
      FROM hr_employee
      WHERE birthday IS NOT NULL
      ORDER BY 
        EXTRACT(MONTH FROM birthday),
        EXTRACT(DAY FROM birthday),
        name
    `);

    pgConnection.release();
    pgConnection = null;

    const birthdays = rows.map((row) => ({
      name: row.employee_name,
      date_of_birth: row.date_of_birth,
      isToday: row.is_today,
      isTomorrow: row.is_tomorrow,
    }));

    res.json({
      success: true,
      birthdays,
      todayCount: birthdays.filter((b) => b.isToday).length,
      tomorrowCount: birthdays.filter((b) => b.isTomorrow).length,
      total: birthdays.length,
    });
  } catch (error) {
    console.error("Error fetching all birthdays:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.get("/birthdays", async (req, res) => {
  let pgConnection = null;

  try {
    pgConnection = await pgPool.connect();

    const { rows } = await pgConnection.query(`
      SELECT 
        name AS employee_name,
        birthday AS date_of_birth,
        CASE 
          WHEN TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE, 'MM-DD') THEN true
          ELSE false
        END AS is_today,
        CASE 
          WHEN TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'MM-DD') THEN true
          ELSE false
        END AS is_tomorrow
      FROM hr_employee
      WHERE birthday IS NOT NULL 
        AND (
          TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE, 'MM-DD')
          OR TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE + INTERVAL '1 day', 'MM-DD')
        )
      ORDER BY 
        CASE 
          WHEN TO_CHAR(birthday, 'MM-DD') = TO_CHAR(CURRENT_DATE, 'MM-DD') THEN 0
          ELSE 1
        END,
        name
    `);

    pgConnection.release();
    pgConnection = null;

    const birthdays = rows.map((row) => ({
      name: row.employee_name,
      date_of_birth: row.date_of_birth,
      isToday: row.is_today,
      isTomorrow: row.is_tomorrow,
    }));

    res.json({
      success: true,
      birthdays,
      todayCount: birthdays.filter((b) => b.isToday).length,
      tomorrowCount: birthdays.filter((b) => b.isTomorrow).length,
      total: birthdays.length,
    });
  } catch (error) {
    console.error("Error fetching birthdays:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.put("/birthdays/update", async (req, res) => {
  let pgConnection = null;

  try {
    const { name, birthday } = req.body;

    if (!name || !birthday) {
      return res.status(400).json({ error: "Name and birthday are required" });
    }

    pgConnection = await pgPool.connect();

    // Update the birthday for the employee
    const result = await pgConnection.query(
      `UPDATE hr_employee 
       SET birthday = $1 
       WHERE LOWER(name) = LOWER($2)`,
      [birthday, name]
    );

    pgConnection.release();
    pgConnection = null;

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Employee not found" });
    }

    res.json({
      success: true,
      message: "Birthday updated successfully",
    });
  } catch (error) {
    console.error("Error updating birthday:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (pgConnection) {
      try {
        pgConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.get("/users", async (req, res) => {
  let mysqlConnection = null;

  try {
    mysqlConnection = await mysqlPool.getConnection();

    const [users] = await mysqlConnection.execute(
      `SELECT id, name, phone, branch, designation FROM agents_data.Users_details ORDER BY branch, name`
    );

    mysqlConnection.release();
    mysqlConnection = null;

    // Group users by branch
    const groupedUsers = {
      AHMEDABAD: [],
      NOIDA: [],
      CHENNAI: [],
      OTHER: [],
    };

    users.forEach((user) => {
      const branchKey = user.branch?.toUpperCase() || "OTHER";
      if (groupedUsers[branchKey]) {
        groupedUsers[branchKey].push(user);
      } else {
        groupedUsers.OTHER.push(user);
      }
    });

    res.json({
      success: true,
      users,
      groupedUsers,
      total: users.length,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.get("/users/:branch", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { branch } = req.params;
    mysqlConnection = await mysqlPool.getConnection();

    let query = `SELECT id, name, phone, branch, designation FROM agents_data.Users_details`;
    const params = [];

    if (branch.toUpperCase() !== "ALL") {
      query += ` WHERE UPPER(branch) = ?`;
      params.push(branch.toUpperCase());
    }

    query += ` ORDER BY name`;

    const [users] = await mysqlConnection.execute(query, params);

    mysqlConnection.release();
    mysqlConnection = null;

    res.json({
      success: true,
      branch: branch.toUpperCase(),
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Error fetching users by branch:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.post("/users", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { name, phone, branch } = req.body;

    if (!name || !phone || !branch) {
      return res
        .status(400)
        .json({ error: "Name, phone and branch are required" });
    }

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone || formattedPhone.length < 10) {
      return res.status(400).json({ error: "Invalid phone number format" });
    }

    mysqlConnection = await mysqlPool.getConnection();

    const [existing] = await mysqlConnection.execute(
      `SELECT id FROM agents_data.Users_details WHERE phone = ?`,
      [phone]
    );

    if (existing.length > 0) {
      mysqlConnection.release();
      return res.status(400).json({ error: "Phone number already exists" });
    }

    const [result] = await mysqlConnection.execute(
      `INSERT INTO agents_data.Users_details (name, phone, branch) VALUES (?, ?, ?)`,
      [name, phone, branch.toUpperCase()]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    res.json({
      success: true,
      message: "User added successfully",
      user: {
        id: result.insertId,
        name,
        phone,
        branch: branch.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.put("/users/:id", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { id } = req.params;
    const { name, phone, branch } = req.body;

    if (!name || !phone || !branch) {
      return res
        .status(400)
        .json({ error: "Name, phone and branch are required" });
    }

    mysqlConnection = await mysqlPool.getConnection();

    const [existing] = await mysqlConnection.execute(
      `SELECT id FROM agents_data.Users_details WHERE phone = ? AND id != ?`,
      [phone, id]
    );

    if (existing.length > 0) {
      mysqlConnection.release();
      return res
        .status(400)
        .json({ error: "Phone number already exists for another user" });
    }

    await mysqlConnection.execute(
      `UPDATE agents_data.Users_details SET name = ?, phone = ?, branch = ? WHERE id = ?`,
      [name, phone, branch.toUpperCase(), id]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    res.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: Number.parseInt(id),
        name,
        phone,
        branch: branch.toUpperCase(),
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.delete("/users/:id", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { id } = req.params;

    mysqlConnection = await mysqlPool.getConnection();

    const [result] = await mysqlConnection.execute(
      `DELETE FROM agents_data.Users_details WHERE id = ?`,
      [id]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.post("/users/delete-bulk", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "User IDs array is required" });
    }

    mysqlConnection = await mysqlPool.getConnection();

    const placeholders = ids.map(() => "?").join(",");
    const [result] = await mysqlConnection.execute(
      `DELETE FROM agents_data.Users_details WHERE id IN (${placeholders})`,
      ids
    );

    mysqlConnection.release();
    mysqlConnection = null;

    res.json({
      success: true,
      message: `${result.affectedRows} user(s) deleted successfully`,
      deletedCount: result.affectedRows,
    });
  } catch (error) {
    console.error("Error deleting users:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.get("/users/search/:query", async (req, res) => {
  let mysqlConnection = null;

  try {
    const { query } = req.params;

    mysqlConnection = await mysqlPool.getConnection();

    const [users] = await mysqlConnection.execute(
      `SELECT id, name, phone, branch, designation FROM agents_data.Users_details 
       WHERE name LIKE ? OR phone LIKE ? OR branch LIKE ? OR designation LIKE ?
       ORDER BY name`,
      [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
    );

    mysqlConnection.release();
    mysqlConnection = null;

    res.json({
      success: true,
      users,
      total: users.length,
    });
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ error: error.message });
  } finally {
    if (mysqlConnection) {
      try {
        mysqlConnection.release();
      } catch (e) {
        /* ignore */
      }
    }
  }
});

router.post("/send-to-group", async (req, res) => {
  try {
    const { groupId, message, mentions = [] } = req.body;

    if (!groupId) {
      return res.status(400).json({ error: "Group ID is required" });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    const apiUrl =
      process.env.WHATSAPP_GROUP_API_URL ||
      "https://api-ping.blutec.ai/api/whatsapp/send-group-message";
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || "SS0BOU";

    console.log("Sending to WhatsApp group:", groupId);
    console.log("Message:", message);
    console.log("Mentions:", mentions);

    const payload = {
      instance_id: instanceId,
      group_id: groupId,
      message: message,
      message_type: "text",
      mentions: mentions.map((num) => {
        // Format mention numbers (remove +, ensure it's just digits)
        return num.replace(/[^0-9]/g, "");
      }),
    };

    console.log("Payload:", JSON.stringify(payload));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    console.log(`Response status: ${response.status}`);

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text();
      console.error("Non-JSON response:", textResponse);

      // If status is OK but not JSON, consider it success
      if (response.ok) {
        return res.json({
          success: true,
          message: "Message sent to group successfully",
        });
      }

      throw new Error(
        `API returned non-JSON response: ${
          response.status
        } - ${textResponse.substring(0, 200)}`
      );
    }

    const result = await response.json();
    console.log("API Response:", result);

    if (
      response.ok &&
      (result.message || result.status === "success" || result.success)
    ) {
      res.json({
        success: true,
        message: "Message sent to group successfully",
        result,
      });
    } else {
      throw new Error(result.error || result.message || JSON.stringify(result));
    }
  } catch (error) {
    console.error("Error sending to group:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/send-broadcast", async (req, res) => {
  try {
    const { fromNumber, message, users, excludedIds = [] } = req.body;
    console.log("Request Body:", req.body);

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: "At least one user is required" });
    }

    const filteredContacts = users.filter(
      (user) => !excludedIds.includes(user.id)
    );

    if (filteredContacts.length === 0) {
      return res.status(400).json({
        error: "No contacts to send message to after exclusions",
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    const apiUrl = getWhatsAppApiUrl();
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || "SS0BOU";

    console.log("WhatsApp API URL:", apiUrl);
    console.log("Instance ID:", instanceId);

    for (const user of filteredContacts) {
      const formattedNumber = formatPhoneNumber(user.phone);

      if (!formattedNumber) {
        results.failed.push({
          user,
          error: "Invalid phone number",
        });
        continue;
      }

      let attempts = 0;
      let sent = false;

      while (attempts < 3 && !sent) {
        attempts++;

        try {
          const payload = {
            instance_id: instanceId,
            contacts: [formattedNumber],
            message: message,
            message_type: "text",
          };

          console.log(
            `Attempt ${attempts} - Sending to ${formattedNumber}:`,
            payload
          );

          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
            },
            body: JSON.stringify(payload),
          });

          console.log(`Response status: ${response.status}`);
          console.log(`Response headers:`, response.headers);

          const contentType = response.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            const textResponse = await response.text();
            console.error("Non-JSON response:", textResponse);
            throw new Error(
              `API returned non-JSON response: ${
                response.status
              } - ${textResponse.substring(0, 200)}`
            );
          }

          const result = await response.json();
          console.log("API Response:", result);

          if (response.ok && (result.message || result.status === "success")) {
            results.success.push({
              user,
              formattedNumber,
            });
            sent = true;
          } else {
            throw new Error(
              result.error || result.message || JSON.stringify(result)
            );
          }
        } catch (error) {
          console.error(`Error sending to ${formattedNumber}:`, error);
          if (attempts >= 3) {
            results.failed.push({
              user,
              formattedNumber,
              error: error.message,
            });
          } else {
            await sleep(4000);
          }
        }
      }

      if (sent) {
        await sleep(5000);
      }
    }

    res.json({
      success: true,
      message: `Broadcast complete. ${results.success.length} sent, ${results.failed.length} failed.`,
      results,
    });
  } catch (error) {
    console.error("Error sending broadcast:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/contacts/:branch", async (req, res) => {
  try {
    const { branch } = req.params;

    const response = await fetch(
      `http://localhost:${
        process.env.PORT || 5000
      }/api/messaging/users/${branch}`
    );
    const data = await response.json();

    res.json({
      branch,
      contacts:
        data.users?.map((u) => ({
          name: u.name,
          work_phone: u.phone,
          branch: u.branch,
        })) || [],
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/send", async (req, res) => {
  try {
    const { fromNumber, message, contacts } = req.body;

    if (!message || !contacts || contacts.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const users = contacts.map((c, index) => ({
      id: index,
      name: c.name,
      phone: c.work_phone || c.phone,
      branch: c.branch,
    }));

    const results = {
      success: [],
      failed: [],
    };

    const apiUrl = getWhatsAppApiUrl();
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || "SS0BOU";

    for (const user of users) {
      const formattedNumber = formatPhoneNumber(user.phone);

      if (!formattedNumber) {
        results.failed.push({ user, error: "Invalid phone number" });
        continue;
      }

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
          },
          body: JSON.stringify({
            instance_id: instanceId,
            contacts: [formattedNumber],
            message: message,
            message_type: "text",
          }),
        });

        const result = await response.json();

        if (response.ok && (result.message || result.status === "success")) {
          results.success.push({ user, formattedNumber });
        } else {
          results.failed.push({ user, error: JSON.stringify(result) });
        }
      } catch (error) {
        results.failed.push({ user, error: error.message });
      }

      await sleep(5000);
    }

    res.json({
      success: true,
      message: `Message sent to ${results.success.length} contacts`,
      details: {
        from: fromNumber,
        recipientCount: results.success.length,
        failedCount: results.failed.length,
      },
      results,
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
