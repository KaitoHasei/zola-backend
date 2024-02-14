const { ObjectId } = require("mongodb");
const _ = require("lodash");

exports.checkUserInConversation = async (conversationId, context) => {
  const { session, prisma } = context;

  try {
    const numberExists = await prisma.conversation.count({
      where: {
        id: conversationId,
        participantIds: {
          has: session.id,
        },
      },
    });

    return numberExists ? true : false;
  } catch (error) {
    console.log(error);
  }
};

const convertRawData = (data) => {
  if (_.isArray(data)) {
    return data.map((item) => convertRawData(item));
  } else if (_.isObject(data) && data !== null) {
    const newObj = {};

    for (const key in data) {
      if (key === "$oid") {
        return new ObjectId(data[key]).toHexString();
      } else if (key === "$date") {
        return data[key];
      } else {
        newObj[key] = convertRawData(data[key]);
      }

      if (key === "_id") {
        newObj["id"] = newObj["_id"];
        delete newObj["_id"];
      }
    }
    return newObj;
  }
  return data;
};

exports.convertRawData = convertRawData;
