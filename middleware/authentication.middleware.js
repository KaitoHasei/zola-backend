const { getAuth } = require("firebase-admin/auth");

const authenticationMiddleware = async (req, res, next) => {
  const { prisma } = req.context;
  const regex = /Bearer (.+)/i;

  try {
    const token = req.headers["authorization"]?.match(regex)?.[1] || "";

    if (!token) throw { code: "unauthenticated" };

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
        bio : true,
        dob : true
      },
    });

    req.context = { ...req.context, session };

    next();
  } catch (error) {
    const { code } = error;
    if (
      code === "unauthenticated" ||
      code === "auth/id-token-expired" ||
      code === "auth/argument-error"
    )
      return res.status(401).json({ error: { code: "unauthenticated" } });
    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

const socketAuthMiddleware = async (socket, next) => {
  const { prisma } = socket.request.context;

  const regex = /Bearer (.+)/i;

  try {
    const token =
      socket.request.headers["authorization"]?.match(regex)?.[1] || "";

    if (!token) throw { code: "unauthenticated" };

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

    socket.request.context = { ...socket.request.context, session };
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { authenticationMiddleware, socketAuthMiddleware };
