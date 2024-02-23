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
