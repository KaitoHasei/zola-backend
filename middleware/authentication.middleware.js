const { getAuth } = require("firebase-admin/auth");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const authenticationMiddleware = async (req, res, next) => {
  const regex = /Bearer (.+)/i;

  try {
    const token = req.headers["authorization"].match(regex)?.[1];
    const verified = await getAuth().verifyIdToken(token);

    const session = await prisma.user.findUnique({
      where: {
        uid: verified.uid,
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        createdAt: true,
      },
    });

    req.session = session;
    next();
  } catch (error) {
    res.status(401).json({ error: { code: "unauthenticated" } });
  }
};

module.exports = authenticationMiddleware;
