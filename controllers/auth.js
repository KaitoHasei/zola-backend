const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} = require("firebase/auth");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

exports.register = async (req, res) => {
  const { username = "", email, password } = req.body;

  try {
    if (!username.trim()) throw { code: "auth/invalid-username" };

    const auth = getAuth();
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (credential && auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      await updateProfile(auth.currentUser, {
        displayName: username,
      });
    }

    const { user } = credential;

    await prisma.user.create({
      data: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: new Date(user.metadata.creationTime),
      },
    });

    return res.status(201).end();
  } catch (err) {
    const { code } = err;
    if (code === "auth/email-already-in-use") {
      res.status(400);
    } else if (code === "auth/invalid-username") {
      res.status(400);
    } else {
      res.status(500);
    }
    res.json({
      error: {
        code: code ? code.replace("auth/", "") : undefined,
      },
    });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const auth = getAuth();

    const credential = await signInWithEmailAndPassword(auth, email, password);

    if (!credential.user.emailVerified) throw { code: "auth/email-not-verify" };

    const token = await auth.currentUser.getIdToken();

    res.status(200).json({ access_token: token });
  } catch (err) {
    const { code } = err;
    if (
      code === "auth/wrong-password" ||
      code === "auth/user-not-found" ||
      code === "auth/email-not-verify"
    ) {
      res.status(403);
    } else {
      res.status(500);
    }
    res.json({
      error: {
        code: code ? code.replace("auth/", "") : "",
      },
    });
  }
};
