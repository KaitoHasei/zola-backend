const config = require("../config/environment");
const { checkUserById, updateUser } = require("../utils");

exports.me = async (req, res) => {
  const user = req.context.session;
  return res.status(200).json(user);
};

exports.find = async (req, res) => {
  const { prisma, session } = req.context;
  const email = req.query.email || "";
  const page = parseInt(req.query.page) || 0;
  const pageSize = parseInt(req.query.pageSize) || 10;

  const excludePatterns = [
    ".com",
    ".org",
    ".net",
    "com",
    "org",
    "net",
    "@",
    "@gmail",
    "gmail",
  ];

  try {
    if (!email.trim()) throw { code: "invalid-term" };

    if (excludePatterns.includes(email))
      return res.status(200).json({ list: [] });

    const listUser = await prisma.user.findMany({
      where: {
        email: {
          contains: email,
        },
        NOT: {
          id: session.id,
        },
      },
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
      },
      skip: page * pageSize,
      take: pageSize,
    });

    return res.status(200).json({ list: listUser });
  } catch (error) {
    const { code } = error;
    if (code === "invalid-term")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.uploadPhoto = async (req, res) => {
  const { session, prisma, s3 } = req.context;
  const photo = req.file;

  try {
    if (!photo?.buffer) throw { code: "empty-file" };

    const params = {
      Bucket: config.AWS_S3_BUCKET_NAME,
      Key: `users/${session.id}/avatar-${Date.now()}`,
      Body: photo.buffer,
      ContentType: photo.mimetype,
    };

    const avatarUploaded = await s3.upload(params).promise();

    const avatarUser = await prisma.user.update({
      data: {
        photoUrl: avatarUploaded.Location,
      },
      where: {
        id: session.id,
      },
      select: {
        photoUrl: true,
      },
    });

    return res.status(200).json({ photoUrl: avatarUser.photoUrl });
  } catch (error) {
    const { code } = error;
    if (code === "empty-file") return res.status(403).json({ error: { code } });
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.update = async (req, res) => {
  const { userChange } = req.body;
  console.log("req : ", req)
  const { userId } = req.params;
  try {
    if(!userId ) throw { code: "Invalid-userId" };
    console.log("userId : ", userId)
    console.log("update user : ", userChange)
    if(!userChange ) throw { code : "Invalid-Infomation-User"};
    const checkingUser = await checkUserById(userId);
    if(!checkingUser) throw {code : "User-is-not-exist"};
    const updating = await updateUser(userId, userChange);
    if(updating) {
      res.status(201).json({ "update" : updating })
    }
  } catch(error) {
    console.log("Error update user : ", error)
    res.status(500).json({ error : {code : "something went wrong"}})
  }
}