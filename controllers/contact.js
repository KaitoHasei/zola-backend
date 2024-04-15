const config = require("../config/environment");

exports.getAllContact = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
        email: true,
      },
    });
    const friends = await prisma.friend.findMany({
      where: {
        userId: session.id,
      },
      select: {
        friendId: true,
        status: true,
      },
    });
    const friendMap = {};
    friends.forEach(friend => {
      friendMap[friend.friendId] = friend.status;
    });

    const data = users.map(user => {
      const status = friendMap[user.id];
      return {
        id: user.id,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        email: user.email,
        status: status,
      };
    });
    const  formatInputValue = (inputArray) =>{
      const formattedArray = inputArray.map(item => ({
        ...item,
        status: item.status !== undefined ? item.status : -1
      }));
      return formattedArray;
    }
    const dataOut = formatInputValue(data);

    res.status(200).json(dataOut);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'internal server error !' });
  }
}

exports.sendFriendRequest = async (req, res) => {
  const { prisma, session } = req.context;
  const { friendId } = req.body;
  console.log("request body : ", req.body);
  try {
    const existingFriend = await prisma.friend.findFirst({
      where: {
        userId: session.id,
        friendId: friendId
      }
    });

    if (existingFriend) {
      res.status(200).json({ message: 'Friend request already exists', statusFriend: existingFriend.status });
    } else {
      const newFriendRequest = await prisma.friend.create({
        data: {
          userId: session.id,
          friendId: friendId,
          status: 0
        }
      });
      res.status(201).json({ message: 'Send request successfully', data: newFriendRequest });
      /* create notification */
    }
  } catch (error) {
    console.error("Error sending friend request: ", error);
    res.status(500).json({ error: 'Internal server error!' });
  }
}

exports.aceptFriendRequest = async (req, res) => {
  const { prisma, session } = req.context;
  const { friendId } = req.body;
  try {
    const updateAcceptFriendRequest = await prisma.friend.updateMany({
      where: {
        userId: friendId,
        friendId: session.id,
        status: 0,
      },
      data: {
        status: 1
      }
    });
    res.status(200).json({ message: 'acepted successfully ', data: updateAcceptFriendRequest });
  } catch (error) {
    res.status(500).json({ error: 'internal server error !' });
  }
}

exports.getFriendRequestUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    const listFriendRequests = await prisma.friend.findMany({
      where: {
        friendId: session.id,
        status: 0
      },
      include: {
        user: true,
      }
    });
    res.status(500).json(listFriendRequests);
  } catch (error) {
    res.status(500).json({ error: 'server internal error !' });
  }
}

exports.getAllFriendUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    const listFriends = await prisma.friend.findMany({
      where: {
        userId: session.id,
        status: 1,
      },
      include: {
        friend: true,
      }
    });
    res.status(200).json(listFriends);
  } catch (error) {
    res.status(500).json({ error: 'internal server error !' });
  }
}
