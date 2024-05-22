const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
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

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const auth = getAuth();
    const actionCodeSettings = {
      url: "http://localhost:3000/login",
      handleCodeInApp: true,
    };
    await sendPasswordResetEmail(auth, email, actionCodeSettings);

    res.status(200).json({ message: "Password reset email sent successfully" });
  } catch (error) {
    console.log("error : ", error);
    const { code } = error;
    if (code === "auth/user-not-found") {
      res.status(404).json({ error: "User not found" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
};

exports.logout = async (req, res) => {
  try {
    const auth = getAuth();

    await signOut(auth);

    res
      .status(200)
      .json({ success: true, message: "User logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res
      .status(500)
      .json({ success: false, error: "An error occurred while logging out" });
  }
};
