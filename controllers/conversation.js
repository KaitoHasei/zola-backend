const _ = require("lodash");

const config = require("../config/environment");

const { checkUserInConversation, convertRawData } = require("../utils");

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.post = async (req, res) => {
  const { session, prisma, io } = req.context;
  const { participantIds = [], groupName = "" } = req.body;

  try {
    if (!_.isArray(participantIds)) throw { code: "invalid-params" };

    const indexOfCurrentUser = participantIds.indexOf(session.id);
    if (indexOfCurrentUser !== -1) participantIds.splice(indexOfCurrentUser, 1);

    if (_.isEmpty(participantIds)) throw { code: "invalid-params" };

    let conversationId = "";

    if (participantIds.length === 1) {
      const _participantIds = [session.id, participantIds[0]];

      const conversationExisted = await prisma.conversation.findFirst({
        where: {
          AND: {
            participantIds: {
              hasEvery: _participantIds,
            },
            isGroup: false,
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
        select: {
          id: true,
        },
      });

      conversationId = conversation.id;
    }

    return res.status(201).json({ id: conversationId });
  } catch (error) {
    const { code } = error;

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
            $or: [{ message: { $exists: true } }, { isGroup: true }],
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

    if (code === "invalid-conversationId")
      return res.status(400).json({ error: { code } });
    else if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.updateGroupImage = async (req, res) => {
  const { session, io, s3 } = req.context;
  const { conversationId } = req.params;
  const groupImage = req.file;

  try {
    if (!groupImage?.buffer) throw { code: "empty-file" };

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        groupOwner: true,
      },
    });

    if (!conversation || conversation.groupOwner !== session.id)
      throw { code: "invalid-conversationId" };

    const params = {
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: `conversations/${conversationId}/avatars/avatarGroup-${Date.now()}`,
      Body: groupImage.buffer,
      ContentType: groupImage.mimetype,
    };

    const avatarUploaded = await s3.upload(params).promise();

    const conversationUpdated = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        groupImage: avatarUploaded.Location,
      },
      select: {
        id: true,
        participantIds: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        userSeen: true,
        isGroup: true,
        groupName: true,
        groupImage: true,
        groupOwner: true,
        updatedAt: true,
      },
    });

    io.to(conversationUpdated.participantIds).emit(
      "conversation_updated",
      conversationUpdated
    );

    return res.status(200).json(conversationUpdated);
  } catch (error) {
    const { code } = error;
    if (code === "empty-file") return res.status(403).json({ error: { code } });
    if (code === "invalid-conversationId")
      return res.status(400).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.updateGroup = async (req, res) => {
  const { session, io } = req.context;
  const { conversationId } = req.params;
  const { groupName } = req.body;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        groupOwner: true,
      },
    });

    if (!conversation || conversation.groupOwner !== session.id)
      throw { code: "invalid-conversationId" };

    const conversationUpdated = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        groupName,
      },
      select: {
        id: true,
        participantIds: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        userSeen: true,
        isGroup: true,
        groupName: true,
        groupImage: true,
        groupOwner: true,
        updatedAt: true,
      },
    });

    io.to(conversationUpdated.participantIds).emit(
      "conversation_updated",
      conversationUpdated
    );

    return res.status(200).json(conversationUpdated);
  } catch (error) {
    const { code } = error;

    if (code === "invalid-conversationId")
      return res.status(400).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.addGroupMembers = async (req, res) => {
  const { session, io } = req.context;
  const { conversationId = "" } = req.params;
  const { participantIds = [] } = req.body;

  try {
    if (!_.isArray(participantIds)) throw { code: "invalid-params" };

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
    });

    if (!conversation.isGroup || conversation?.groupOwner !== session.id)
      throw { code: "user-has-not-permission" };

    const _participantIds = conversation.participantIds;
    const _newParticipantIds = [..._participantIds, ...participantIds];

    const conversationUpdated = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        participantIds: _newParticipantIds,
      },
      select: {
        id: true,
        participantIds: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        userSeen: true,
        isGroup: true,
        groupName: true,
        groupImage: true,
        groupOwner: true,
        updatedAt: true,
      },
    });

    io.to(conversationUpdated.participantIds).emit(
      "conversation_updated",
      conversationUpdated
    );

    return res.status(200).json(conversationUpdated);
  } catch (error) {
    const { code } = error;
    console.log(error);

    if (code === "invalid-conversationId")
      return res.status(400).json({ error: { code } });

    if (code === "user-has-not-permission")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};

exports.removeGroupMember = async (req, res) => {
  const { session, io } = req.context;
  const { conversationId = "", userId = "" } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: conversationId,
      },
      select: {
        id: true,
        participantIds: true,
        isGroup: true,
        groupOwner: true,
      },
    });

    if (!conversation.isGroup || conversation?.groupOwner !== session.id)
      throw { code: "user-has-not-permission" };

    if (conversation.participantIds.length === 3)
      throw { code: "must-least-3-members" };

    const conversationParticipantIds = [...conversation.participantIds];

    _.remove(conversationParticipantIds, (item) => item === userId);

    const conversationUpdated = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        participantIds: {
          set: conversationParticipantIds,
        },
      },
      select: {
        id: true,
        participantIds: true,
        participants: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
        userSeen: true,
        isGroup: true,
        groupName: true,
        groupImage: true,
        groupOwner: true,
        updatedAt: true,
      },
    });

    io.to(conversationUpdated.participantIds).emit(
      "conversation_updated",
      conversationUpdated
    );

    io.to(userId).emit("removed_from-group", {
      id: conversationUpdated.id,
    });

    return res.status(200).json(conversationUpdated);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};
