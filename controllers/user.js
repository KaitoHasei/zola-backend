exports.me = async (req, res) => {
  const user = req.session;
  return res.status(200).json(user);
};
