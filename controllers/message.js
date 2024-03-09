const { checkUserInConversation, convertRawData } = require("../utils");

exports.post = async (req, res) => {
  const { session, prisma, io } = req.context;
  const { conversationId } = req.params;
  const { content } = req.body;

  try {
    if (!content) throw { code: "invalid-message" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "conversation-not-exist" };

    const conversation = await prisma.conversation.update({
      data: {
        message: {
          push: {
            userId: session.id,
            content,
          },
        },
        userSeen: [session.id],
      },
      where: {
        id: conversationId,
      },
      include: {
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
      },
    });

    const newMessage = conversation?.message?.pop();

    io.of("/chats").to(conversationId).emit("sent_message", {
      id: conversation.id,
      message: newMessage,
    });

    io.to(conversation.participantIds).emit("conversation_updated", {
      id: conversation.id,
      participants: conversation.participants,
      userSeen: conversation.userSeen,
      name: conversation.name,
      image: conversation.image,
      latestMessage: newMessage,
      createdBy: conversation.createdBy,
      updatedAt: conversation.updatedAt,
    });

    return res.status(200).end();
  } catch (error) {
    const { code } = error;

    if (code === "invalid-message")
      return res.status(400).json({ error: { code } });
    else if (code === "conversation-not-exist")
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

    if (!isInConversation) throw { code: "conversation-not-exist" };

    const rawMessages = await prisma.conversation.aggregateRaw({
      pipeline: [
        { $match: { _id: { $oid: conversationId } } },
        { $unwind: "$message" },
        { $sort: { "message.createdAt": -1 } },
        { $skip: page * pageSize },
        { $limit: pageSize },
        { $group: { _id: "$_id", message: { $push: "$message" } } },
        // { $project: { message: { $reverseArray: "$message" } } },
      ],
    });

    const convertedMessage = convertRawData(rawMessages);

    return res.status(200).json(convertedMessage[0]);
  } catch (error) {
    const { code } = error;

    if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

// exports.sendImages = (req, res) => {
//   const photos = req.files;
//   console.log({ photos });
//   return res.status(500).json({ error: { code: "something went wrong" } });
// };
