const { ObjectId } = require("mongodb");
const _ = require("lodash");

exports.checkUserById = async ( userId ) => {
  const { prisma} = context;
  try {
    const user = prisma.user.findUnique({
      where : {
        id : userId
      }
    })
    return !!user;
  } catch(error) {
    console.log("Error check user : ", error)
    return false;
  }
}
exports.updateUser = async (userId, dataUpdate) => {
  const { prisma } = context;
  try {
    const user = await prisma.user.update({
      where : {
        id : userId
      },
      data : dataUpdate,
    });
    return !!user;
  } catch(error) {
    console.log("Error updating : ", error);
    return false;
  }
}
exports.checkUserInConversation = async (conversationId, context) => {
  const { session, prisma } = context;

  const numberExists = await prisma.conversation.count({
    where: {
      id: conversationId,
      participantIds: {
        has: session.id,
      },
    },
  });

  return numberExists ? true : false;
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
