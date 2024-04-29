const { getAuth: getAuthAdmin } = require("firebase-admin/auth");
const _ = require("lodash");

const emailRegex = new RegExp(
  /^[A-Za-z0-9_!#$%&'*+\/=?`{|}~^.-]+@[A-Za-z0-9.-]+$/,
  "gm"
);

exports.findFriend = async (req, res) => {
  const { prisma } = req.context;
  const { email = "" } = req.query;

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
    console.log(error);

    if (code === "invalid-email")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.getContacts = async (req, res) => {
  const { prisma, session } = req.context;

  try {
    const contactByUserId = await prisma.contact.findUnique({
      where: {
        userId: session.id,
      },
      select: {
        id: true,
        friendList: {
          select: {
            id: true,
            displayName: true,
            photoUrl: true,
          },
        },
      },
    });

    if (!contactByUserId) return res.status(200).json({});

    return res.status(200).json(contactByUserId);
  } catch (error) {
    console.log(error);

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};

exports.sendFriendRequest = async (req, res) => {
  const { prisma, session } = req.context;
  const { toUserId = "" } = req.body;

  try {
    if (!toUserId.trim()) throw { code: "invalid-user" };

    const userById = await prisma.user.findUnique({
      where: {
        id: toUserId,
      },
      select: {
        id: true,
      },
    });

    if (!userById) throw { code: "invalid-user" };

    const transactionSendRequest = await prisma.$transaction([
      prisma.contact.upsert({
        where: {
          AND: {
            userId: toUserId,
            NOT: {
              requestFriendByIds: {
                has: session.id,
              },
            },
          },
        },
        create: {
          userId: toUserId,
          requestFriendByIds: {
            set: [session.id],
          },
        },
        update: {
          requestFriendByIds: {
            push: session.id,
          },
        },
        select: {
          id: true,
        },
      }),
      prisma.contact.upsert({
        where: {
          userId: session.id,
          NOT: {
            sentRequestFriendToIds: {
              has: toUserId,
            },
          },
        },
        create: {
          userId: session.id,
          sentRequestFriendToIds: {
            set: [toUserId],
          },
        },
        update: {
          sentRequestFriendToIds: {
            push: toUserId,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    return res.status(200).end();
  } catch (error) {
    const { code } = error;
    console.log(error);

    if (code === "invalid-user")
      return res.status(403).json({ error: { code } });

    return res.status(500).json({ error: { code: "something went wrong!" } });
  }
};
