const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
} = require("firebase/auth");
const { getAuth: getAuthAdmin } = require("firebase-admin/auth");

exports.register = async (req, res) => {
  const { prisma } = req.context;
  const { username = "", email = "", password = "" } = req.body;

  try {
    if (!username.trim()) throw { code: "auth/invalid-username" };

    const auth = getAuth();
    const credentials = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (credentials && auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
      await updateProfile(auth.currentUser, {
        displayName: username,
      });
    }

    const { user } = credentials;

    await prisma.user.create({
      data: {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
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
  const { email = "", password = "" } = req.body;

  try {
    const auth = getAuth();
    const authAdmin = getAuthAdmin();

    const userByEmail = await authAdmin.getUserByEmail(email);

    if (!userByEmail.emailVerified) throw { code: "auth/email-not-verify" };

    await signInWithEmailAndPassword(auth, email, password);

    const token = await auth.currentUser.getIdToken();

    res.status(200).json({ access_token: token });
  } catch (err) {
    const { code } = err;
    if (
      code === "auth/wrong-password" ||
      code === "auth/invalid-credential" ||
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

/* exports.changePassword = async (req, res) => {
  const { newPassword } = req.body;

  try {
    const auth = getAuth();
    await updatePassword(auth.currentUser, newPassword);

    res.status(200).json({ message: "Password updated successfully." });
  } catch (err) {
    const { code } = err;
    if (code === "auth/requires-recent-login") {
      res.status(401).json({
        error: {
          message: "To change password, re-authenticate the user.",
          code: code.replace("auth/", ""),
        },
      });
    } else {
      res.status(500).json({
        error: {
          message: "An error occurred while updating the password.",
          code: code ? code.replace("auth/", "") : "",
        },
      });
    }
  }
}; */
