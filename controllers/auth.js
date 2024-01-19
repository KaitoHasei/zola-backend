const {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} = require("firebase/auth");

exports.register = async (req, res) => {
  const { email, password } = req.body;

  try {
    const auth = getAuth();
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    res.status(201).json({ credential });
  } catch (err) {
    const { code } = err;
    if (code === "auth/email-already-in-use") {
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
    res.status(200).json({ credential });
  } catch (err) {
    console.log(err);
    const { code } = err;
    if (code === "auth/wrong-password" || code === "auth/user-not-found") {
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
