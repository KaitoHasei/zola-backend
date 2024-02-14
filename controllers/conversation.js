const _ = require("lodash");

const { checkUserInConversation } = require("../utils");

exports.post = async (req, res) => {
  const { session, prisma } = req.context;
  const { participantId = "" } = req.body;

  try {
    if (
      !participantId ||
      (_.isArray(participantId) && _.isEmpty(participantId))
    )
      throw { code: "require-participant" };

    let conversationId = "";

    if (!_.isArray(participantId)) {
      const existed = await prisma.conversation.findFirst({
        where: {
          participantIds: {
            hasEvery: [participantId, session.id],
          },
        },
        select: {
          id: true,
        },
      });

      if (!existed) {
        const conversation = await prisma.conversation.create({
          data: {
            participantIds: [participantId, session.id],
            createdBy: session.id,
          },
          select: {
            id: true,
          },
        });

        conversationId = conversation.id;
      } else {
        conversationId = existed.id;
      }
    } else {
      const conversation = await prisma.conversation.create({
        data: {
          participantIds: [...participantId, session.id],
          createdBy: session.id,
        },
      });

      conversationId = conversation.id;
    }

    return res.status(201).json({ id: conversationId });
  } catch (error) {
    const { code } = error;

    if (code === "require-participant")
      return res.status(400).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};

exports.list = async (req, res) => {
  const { session, prisma } = req.context;
  const page = parseInt(req.query.page) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        participantIds: {
          has: session.id,
        },
      },
      select: {
        id: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        name: true,
        image: true,
        userSeen: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return res.status(200).json({ list: conversations });
  } catch (error) {
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.get = async (req, res) => {
  const { prisma } = req.context;
  const { conversationId = "" } = req.params;

  try {
    if (!conversationId) throw { code: "require-conversationId" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "not-in-conversation" };

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        name: true,
        image: true,
        userSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(conversation);
  } catch (error) {
    const { code } = error;

    if (code === "require-conversationId")
      return res.status(400).json({ error: { code } });
    else if (code === "not-in-conversation")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};
