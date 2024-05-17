const { PrismaClient } = require("@prisma/client");
const _ = require("lodash");

const config = require("../config/environment");

const { checkUserInConversation, convertRawData } = require("../utils");

const prisma = new PrismaClient();

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
            typeMessage: "TEXT",
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
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupImage: conversation.image,
      groupOwner: conversation.groupOwner,
      latestMessage: newMessage,
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

exports.delete = async (req, res) => {
  const { session, io } = req.context;
  const { conversationId, messageCuid } = req.params;

  try {
    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "conversation-not-exist" };

    const conversation = await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        message: {
          updateMany: {
            where: {
              AND: {
                cuid: messageCuid,
                userId: session.id,
              },
            },
            data: {
              isRevoke: true,
            },
          },
        },
      },
      select: {
        id: true,
        message: {
          select: {
            cuid: true,
            isRevoke: true,
          },
        },
      },
    });

    const messageRevokeObj = conversation.message.reduce(
      (obj, item) => ({
        ...obj,
        [item.cuid]: item,
      }),
      {}
    );
    const messageRevoked = messageRevokeObj[messageCuid];

    if (!messageRevoked.isRevoke) throw { code: "can-not-revoke" };

    io.of("/chats").to(conversationId).emit("revoke_message", {
      id: conversation.id,
      cuid: messageRevoked.cuid,
    });

    return res.status(200).end();
  } catch (error) {
    const { code } = error;

    if (code === "conversation-not-exist" || code === "can-not-revoke")
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
        {
          $match: {
            "message.isRevoke": false,
          },
        },
        { $sort: { "message.createdAt": -1 } },
        // { $skip: page * pageSize },
        // { $limit: pageSize },
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

exports.sendImages = async (req, res) => {
  const { session, s3, io } = req.context;
  const { conversationId } = req.params;
  const photos = req.files;

  try {
    if (_.isEmpty(photos)) throw { code: "empty-file" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "conversation-not-exist" };

    let contentUrl = "";

    for (const [index, photo] of photos.entries()) {
      const imageInfo = {
        Bucket: config.AWS_S3_BUCKET_NAME,
        Key: `conversations/${conversationId}/${
          session.id
        }-${Date.now()}${index}`,
        Body: photo.buffer,
        ContentType: photo.mimetype,
      };

      const imageUploaded = await s3.upload(imageInfo).promise();

      if (index === 0) contentUrl = imageUploaded.Location;
      else contentUrl = contentUrl.concat(",", imageUploaded.Location);
    }

    const conversation = await prisma.conversation.update({
      data: {
        message: {
          push: {
            userId: session.id,
            content: contentUrl,
            typeMessage: "IMAGE",
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
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupImage: conversation.groupImage,
      groupOwner: conversation.groupOwner,
      latestMessage: newMessage,
      updatedAt: conversation.updatedAt,
    });

    return res.status(200).end();
  } catch (error) {
    const { code } = error;

    if (code === "empty-file") return res.status(403).json({ error: { code } });
    else if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};

exports.getImages = async (req, res) => {
  const { prisma } = req.context;
  const { conversationId } = req.params;

  try {
    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );

    if (!isInConversation) throw { code: "conversation-not-exist" };

    const imageMessagesRaw = await prisma.conversation.aggregateRaw({
      pipeline: [
        {
          $match: {
            _id: { $oid: conversationId },
          },
        },
        { $unwind: "$message" },
        { $sort: { "message.createdAt": -1 } },
        { $match: { "message.typeMessage": "IMAGE" } },
        // { $skip: page * pageSize },
        // { $limit: pageSize },
        { $group: { _id: "$_id", message: { $push: "$message" } } },
        // { $project: { message: { $reverseArray: "$message" } } },
      ],
    });

    const imageMessages = convertRawData(imageMessagesRaw)[0];
    let listLinkImage = [];

    imageMessages.message.forEach((content) => {
      const linkSplited = content.content?.split(",");

      listLinkImage = [...listLinkImage, ...linkSplited];
    });

    return res.status(200).json(listLinkImage);
  } catch (error) {
    const { code } = error;

    if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.startCallVideo = async (req, res) => {
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
            typeMessage: "CALL",
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
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupImage: conversation.image,
      groupOwner: conversation.groupOwner,
      latestMessage: newMessage,
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

exports.getFile = async (req, res) => {};

exports.sendFile = async (req, res) => {
  const { session, s3, io } = req.context;
  const { conversationId } = req.params;
  const file = req.file;

  try {
    if (_.isEmpty(file)) throw { code: "empty-file" };

    const isInConversation = await checkUserInConversation(
      conversationId,
      req.context
    );
    if (!isInConversation) throw { code: "conversation-not-exist" };

    const fileExtension = file.originalname.split(".").pop();
    const fileName = file.originalname;
    const fileType = file.mimetype;

    const fileInfo = {
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: `${Date.now()}-${fileName}`,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const fileloaded = await s3.upload(fileInfo).promise();
    const contentUrl = fileloaded.Location;

    // Xác định loại tin nhắn dựa trên MIME type
    let typeMessage;
    if (fileType.startsWith("video/")) {
      typeMessage = "VIDEO";
    } else {
      typeMessage = "FILE";
    }

    const conversation = await prisma.conversation.update({
      data: {
        message: {
          push: {
            userId: session.id,
            content: contentUrl,
            typeMessage: typeMessage,
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
      isGroup: conversation.isGroup,
      groupName: conversation.groupName,
      groupImage: conversation.groupImage,
      groupOwner: conversation.groupOwner,
      latestMessage: newMessage,
      updatedAt: conversation.updatedAt,
    });

    return res.status(200).end();
  } catch (error) {
    console.log(error);
    const { code } = error;

    if (code === "empty-file") return res.status(403).json({ error: { code } });
    else if (code === "conversation-not-exist")
      return res.status(403).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};
