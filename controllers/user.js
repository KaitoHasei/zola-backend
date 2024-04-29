const { getAuth: getAuthAdmin } = require("firebase-admin/auth");
const _ = require("lodash");

const config = require("../config/environment");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const emailRegex = new RegExp(
  /^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/,
  "gm"
);

exports.me = async (req, res) => {
  const user = req.context.session;
  return res.status(200).json(user);
};

exports.patch = async (req, res) => {
  const { session, s3 } = req.context;
  const payload = req.body;
  const avatar = req.file;

  try {
    let updateData = {};

    if (
      payload?.displayName?.trim() &&
      payload?.displayName !== session.displayName
    )
      updateData.displayName = payload.displayName;

    if (avatar?.buffer) {
      const params = {
        Bucket: config.AWS_S3_BUCKET_NAME,
        Key: `users/${session.id}/avatar-${Date.now()}`,
        Body: avatar.buffer,
        ContentType: avatar.mimetype,
      };

      const avatarUploaded = await s3.upload(params).promise();

      updateData.photoUrl = avatarUploaded.Location;
    }

    if (_.isEmpty(updateData)) throw { code: "invalid-update" };

    const userUpdated = await prisma.user.update({
      where: {
        id: session.id,
      },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    return res.status(200).json(userUpdated);
  } catch (error) {
    const { code } = error;
    if (code === "invalid-update")
      return res.status(400).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong" } });
  }
};

exports.find = async (req, res) => {
  const { prisma } = req.context;
  const email = req.query.email || "";

  try {
    if (!email.trim() || !emailRegex.test(email))
      throw { code: "invalid-email" };

    const authAdmin = getAuthAdmin();
    const userFirebaseByEmail = await authAdmin.getUserByEmail(email);

    if (_.isEmpty(userFirebaseByEmail) || !userFirebaseByEmail.emailVerified)
      return res.status(200).json();

    const userByUid = await prisma.user.findUnique({
      where: {
        uid: userFirebaseByEmail.uid,
      },
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
      },
    });

    return res.status(200).json(userByUid);
  } catch (error) {
    const { code } = error;
    if (code === "auth/user-not-found") return res.status(200).json();

    if (code === "invalid-email")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};
