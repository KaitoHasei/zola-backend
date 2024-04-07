const _ = require("lodash");

const { checkUserInConversation, convertRawData } = require("../utils");

exports.post = async (req, res) => {
  const { session, prisma } = req.context;
  const { participantId = "" } = req.body;

  try {
    if (
      !participantId ||
      (_.isArray(participantId) && _.isEmpty(participantId))
    )
      throw { code: "invalid-participant" };

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

    if (code === "invalid-participant")
      return res.status(400).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};

exports.someController = async (req, res) => {
  const { session, prisma } = req.context;
  const { participantIds = [], groupName = "" } = req.body;

  try {
    if (!_.isArray(participantIds)) throw { code: "invalid-params" };

    const indexOfCurrentUser = participantIds.indexOf(session.id);
    console.log("indexOfCurrentUser: ", indexOfCurrentUser);
    if (indexOfCurrentUser !== -1) participantIds.splice(indexOfCurrentUser, 1);

    console.log("participantIds: ", participantIds);

    if (_.isEmpty(participantIds)) throw { code: "invalid-params" };

    let conversationId = "";

    if (participantIds.length === 1) {
      const _participantIds = [session.id, participantIds[0]];

      const conversationExisted = await prisma.conversation.findFirst({
        where: {
          participantIds: {
            hasEvery: _participantIds,
          },
        },
        select: {
          id: true,
        },
      });

      if (!conversationExisted) {
        const conversation = await prisma.conversation.create({
          data: {
            participantIds: _participantIds,
          },
          select: {
            id: true,
          },
        });

        conversationId = conversation.id;
      } else {
        conversationId = conversationExisted.id;
      }
    } else {
      const _participantIds = [session.id, ...participantIds];

      const conversation = await prisma.conversation.create({
        data: {
          participantIds: _participantIds,
          isGroup: true,
          groupName: groupName,
          groupOwner: session.id,
        },
      });

      conversationId = conversation.id;
    }

    return res.status(201).json({ id: conversationId });
  } catch (error) {
    const { code } = error;
    console.log(error);

    if (code === "invalid-params")
      return res.status(400).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.list = async (req, res) => {
  const { session, prisma } = req.context;
  const page = parseInt(req.query.page) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;

  try {
    const rawConversations = await prisma.conversation.aggregateRaw({
      pipeline: [
        {
          $match: {
            message: {
              $exists: true,
            },
            $expr: {
              $in: [{ $oid: session.id }, "$participantIds"],
            },
          },
        },
        { $sort: { updatedAt: -1, "message.createdAt": 1 } },
        // { $skip: page * pageSize },
        // { $limit: pageSize },
        {
          $lookup: {
            from: "User",
            localField: "participantIds",
            foreignField: "_id",
            as: "participants",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  displayName: 1,
                  photoUrl: 1,
                },
              },
            ],
          },
        },
        { $addFields: { latestMessage: { $last: "$message" } } },
        {
          $project: {
            participantIds: 0,
            message: 0,
            createdAt: 0,
          },
        },
      ],
    });

    const convertedConversations = convertRawData(rawConversations);

    return res.status(200).json({ list: convertedConversations });
  } catch (error) {
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.get = async (req, res) => {
  const { prisma } = req.context;
  const { conversationId = "" } = req.params;

  try {
    if (!conversationId) throw { code: "invalid-conversationId" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "conversation-not-exist" };

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
        isGroup: true,
        groupName: true,
        groupImage: true,
        groupOwner: true,
        userSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(200).json(conversation);
  } catch (error) {
    const { code } = error;
    console.log(error);

    if (code === "invalid-conversationId")
      return res.status(400).json({ error: { code } });
    else if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};
