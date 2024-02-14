const { checkUserInConversation, convertRawData } = require("../utils");

exports.post = async (req, res) => {
  const { session, prisma } = req.context;
  const { conversationId } = req.params;
  const { content } = req.body;

  try {
    if (!content) throw { code: "require-message" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "not-in-conversation" };

    await prisma.conversation.update({
      data: {
        message: {
          push: {
            userId: session.id,
            content,
          },
        },
      },
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        message: true,
      },
    });

    return res.status(200).end();
  } catch (error) {
    const { code } = error;

    if (code === "require-message")
      return res.status(400).json({ error: { code } });
    else if (code === "not-in-conversation")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.get = async (req, res) => {
  const { prisma } = req.context;
  const { conversationId } = req.params;
  const page = parseInt(req.query.page) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;

  try {
    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "not-in-conversation" };

    const rawMessages = await prisma.conversation.aggregateRaw({
      pipeline: [
        { $match: { _id: { $oid: conversationId } } },
        { $unwind: "$message" },
        { $skip: page * pageSize },
        { $limit: pageSize },
        { $group: { _id: "$_id", message: { $push: "$message" } } },
      ],
    });

    const convertedMessage = convertRawData(rawMessages);

    return res.status(200).json(convertedMessage[0]);
  } catch (error) {
    const { code } = error;

    if (code === "not-in-conversation")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};
