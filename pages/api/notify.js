const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = require("twilio")(accountSid, authToken);
import { connectToDatabase } from "../../lib/mongodb";

export default async (req, res) => {
  const { db } = await connectToDatabase();

  const requestType = req.body?.Body?.toLowerCase().trim();
  switch (requestType) {
    case "start":
      await db
        .collection("recipients")
        .updateOne(
          { phone: req.body.From },
          { $set: { phone: req.body.From, status: "subscribed" } },
          { upsert: true }
        );

      const [{ msg: msg1 }] = await db
        .collection("messages")
        .find({ type: "subscribe" })
        .limit(1)
        .toArray();

      // const twilioStart = await client.messages.create({
      //   body: msg1,
      //   from: process.env.TWILIO_NUMBER,
      //   to: req.body.From,
      // });
      // delete twilioStart._version;
      // delete twilioStart._context;
      // delete twilioStart._solution;

      await db.collection("log").insertOne({
        action: requestType,
        // twilio: { ...twilioStart },
        twilio: { ...req.body },
        created_at: new Date(),
      });

      return res.status(201).json({ msg: "Subscribed" });

    case "stop":
      await db
        .collection("recipients")
        .updateOne(
          { phone: req.body.From },
          { $set: { phone: req.body.From, status: "unsubscribed" } },
          { upsert: true }
        );

      // const [{ msg: msg2 }] = await db
      //   .collection("messages")
      //   .find({ type: "unsubscribe" })
      //   .limit(1)
      //   .toArray();

      // await client.messages.create({
      //   body: msg2,
      //   from: process.env.TWILIO_NUMBER,
      //   to: req.body.From,
      // });

      await db.collection("log").insertOne({
        action: requestType,
        twilio: { ...req.body },
        created_at: new Date(),
      });

      return res.status(201).json({ msg: "Unsubscribed" });

    case "notify":
      if (!req.body?.From?.includes(4010)) {
        await db.collection("log").insertOne({
          action: requestType,
          error: "User does not have access for broadcasting notifications",
          from: req.body?.From,
          created_at: new Date(),
        });

        return res.status(201).json({ msg: "Unauthorized" });
      }

      const recipients = await db
        .collection("recipients")
        .find({ status: "subscribed" })
        .limit(20)
        .toArray();

      const [{ msg }] = await db
        .collection("messages")
        .find({ type: "notify" })
        .limit(1)
        .toArray();

      const numbers = recipients.map(({ phone }) => phone);

      let twillioRes = [];
      for (const to of numbers) {
        const twilioNotify = await client.messages.create({
          body: msg,
          from: process.env.TWILIO_NUMBER,
          to,
        });

        delete twilioNotify._version;
        delete twilioNotify._context;
        delete twilioNotify._solution;

        twillioRes = [...twillioRes, twilioNotify];
      }

      await db.collection("log").insertOne({
        action: requestType,
        to: numbers,
        twilio: twillioRes,
        created_at: new Date(),
      });

      return res.status(201).json({ msg: "Notification broadcasted" });

    default:
      await db.collection("log").insertOne({
        action: "invalid",
        from: req.body.From,
        twilio: req.body,
        created_at: new Date(),
      });

      return res
        .status(200)
        .json({ error: "Invalid command", msg: req.body.Body });
  }
};
