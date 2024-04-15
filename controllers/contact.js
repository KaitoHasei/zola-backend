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
  
  try {
    // Kiểm tra xem đã tồn tại một bản ghi Friend với userId và friendId đã cho
    const existingFriend = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: session.id, friendId: friendId },
          { userId: friendId, friendId: session.id }
        ]
      }
    });

    if (existingFriend) {
      // Nếu tồn tại, kiểm tra trạng thái của bản ghi
      if (existingFriend.status === -1) {
        // Nếu trạng thái là -1, cập nhật lại trạng thái thành 0 (yêu cầu đã bị hủy)
        const updatedFriendRequest = await prisma.friend.update({
          where: { id: existingFriend.id },
          data: { status: 0 }
        });
        res.status(200).json({ message: 'Friend request sent successfully', data: updatedFriendRequest });
      } else {
        // Nếu trạng thái không phải là -1, thông báo rằng yêu cầu đã tồn tại
        res.status(200).json({ message: 'Friend request already exists', statusFriend: existingFriend.status });
      }
    } else {
      // Nếu không có bản ghi Friend nào tồn tại, tạo mới yêu cầu kết bạn với status là 0
      const newFriendRequest = await prisma.friend.create({
        data: {
          userId: session.id,
          friendId: friendId,
          status: 0
        }
      });
      res.status(201).json({ message: 'Friend request sent successfully', data: newFriendRequest });
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
      select: {
        id: true,
        userId: true,
        friendId: true,
        status: true,
        updatedAt: true,
      }
    });
    const friendIds = listFriendRequests.map(request => request.friendId);
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: friendIds
        }
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true
      }
    });

    const friendRequestsWithUser = listFriendRequests.map(request => {
      const friend = users.find(user => user.id === request.friendId);
      return {
        ...request,
        friend: friend
      };
    });

    res.status(200).json(friendRequestsWithUser);
  } catch (error) {
    console.log("eror : ", error)
    res.status(500).json({ error: 'server internal error !' });
  }
}

exports.getAllFriendUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    // Lấy danh sách tất cả các bạn bè của người dùng hiện tại
    const listFriends = await prisma.friend.findMany({
      where: {
        OR: [
          { userId: session.id },
          { friendId: session.id }
        ],
        status: 1
      }
    });

    // Tạo một mảng chứa id của tất cả các bạn bè
    const friendIds = listFriends.map(friend => {
      return friend.userId === session.id ? friend.friendId : friend.userId;
    });

    // Lấy thông tin của các bạn bè từ danh sách id vừa tạo
    const users = await prisma.user.findMany({
      where: {
        id: {
          in: friendIds
        }
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true
      }
    });

    // Gắn thông tin về bạn bè vào kết quả trả về
    const friendsWithUserInfo = listFriends.map(friend => {
      const friendInfo = users.find(user => user.id === (friend.userId === session.id ? friend.friendId : friend.userId));
      return {
        ...friend,
        friend: friendInfo
      };
    });

    res.status(200).json(friendsWithUserInfo);
  } catch (error) {
    console.log("error : ", error);
    res.status(500).json({ error: 'server internal error !' });
  }
}

exports.removeFriend = async (req, res) => {
  const { prisma } = req.context;
  const { id } = req.body;
  
  try {
    // Cập nhật trạng thái của bản ghi Friend có ID được cung cấp
    const updatedFriendRecord = await prisma.friend.update({
      where: { id },
      data: { status: -1 }
    });
    
    res.status(200).json({ message: 'Friend request canceled successfully', data: updatedFriendRecord });
  } catch (error) {
    // Xử lý lỗi
    console.log("Error canceling friend request: ", error);
    res.status(500).json({ error: 'Internal server error' });
  }
}