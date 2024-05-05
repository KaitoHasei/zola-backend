exports.getAllContact = async (req, res) => {
  const { prisma, session } = req.context;

  try {
    // Lấy danh sách tất cả người dùng
    const users = await prisma.user.findMany({
      select: {
        id: true,
        displayName: true,
        photoUrl: true,
        email: true,
      },
    });

    // Lấy danh sách bạn bè của người dùng hiện tại kèm theo trường client
    const friends = await prisma.relationship.findMany({
      where: {
        OR: [
          { client: session.id }, // Lấy các mối quan hệ mà người dùng hiện tại gửi yêu cầu hoặc đã chấp nhận
          { friends: { has: session.id } }, // Lấy các mối quan hệ mà người dùng hiện tại được yêu cầu hoặc đã chấp nhận
        ],
      },
      select: {
        client: true, // Lấy trường client
        friends: true,
        status: true,
      },
    });

    // Tạo một map để lưu trữ trạng thái bạn bè của mỗi người dùng
    const friendMap = {};
    friends.forEach((friend) => {
      // Lưu trạng thái bạn bè vào map
      friend.friends.forEach((friendId) => {
        friendMap[friendId] = { status: friend.status, client: friend.client };
      });
    });

    // Format dữ liệu người dùng
    const data = users.map((user) => {
      const friendData = friendMap[user.id];
      const status = friendData ? friendData.status : 0; // Nếu không có trạng thái, mặc định là 0
      const client = friendData ? friendData.client : null; // Lấy trường client
      return {
        id: user.id,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        email: user.email,
        status: status,
        client: client,
      };
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error!" });
  }
};

exports.sendFriendRequest = async (req, res) => {
  const { prisma, session } = req.context;
  const { friendId } = req.body;

  try {
    // Kiểm tra xem đã tồn tại một bản ghi Relationship với userId và friendId đã cho
    const existingRelationship = await prisma.relationship.findFirst({
      where: {
        AND: [
          {
            friends: { has: session.id },
          }, // Kiểm tra xem có session.id trong mảng friends không
          {
            friends: { has: friendId },
          }, // Kiểm tra xem có friendId trong mảng friends không
          {
            status: 2, // Kiểm tra trạng thái là yêu cầu kết bạn
          },
        ],
      },
    });

    if (existingRelationship) {
      // Nếu tồn tại, trả về bản ghi Relationship đã tồn tại
      return res
        .status(200)
        .json({
          message: "Friend request already exists",
          data: existingRelationship,
        });
    }

    // Nếu không có bản ghi Relationship nào tồn tại, tạo mới một yêu cầu kết bạn
    const currentTime = new Date();
    const newFriendRequest = await prisma.relationship.create({
      data: {
        friends: [session.id, friendId], // Tạo một mối quan hệ giữa session.id và friendId
        status: 2, // Trạng thái là yêu cầu kết bạn
        client: session.id, // Người gửi yêu cầu là session.id
        updatedAt: currentTime, // Cập nhật thời gian
      },
    });
    res
      .status(201)
      .json({
        message: "Friend request sent successfully",
        data: newFriendRequest,
      });
    /* create notification */
  } catch (error) {
    console.error("Error sending friend request: ", error);
    res.status(500).json({ error: "Internal server error!" });
  }
};

exports.aceptFriendRequest = async (req, res) => {
  const { prisma, session } = req.context;
  const { id } = req.body;

  try {
    const currentTime = new Date();
    // Tìm mối quan hệ có friends là mảng chứa id của user hiện tại và id của user được chấp nhận
    const updateAcceptFriendRequest = await prisma.relationship.updateMany({
      where: {
        id: id,
      },
      data: {
        status: 1, // Cập nhật trạng thái thành bạn bè (1)
        updatedAt: currentTime,
      },
    });

    res
      .status(200)
      .json({
        message: "Accepted successfully",
        data: updateAcceptFriendRequest,
      });
  } catch (error) {
    res.status(500).json({ error: "Internal server error!" });
  }
};

exports.getFriendRequestUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    // Tìm các mối quan hệ có đúng 2 người bạn, trong đó một người là người dùng hiện tại và một người là người yêu cầu
    const friendRequests = await prisma.relationship.findMany({
      where: {
        AND: [
          {
            friends: {
              has: session.id, // Người dùng hiện tại có trong danh sách bạn của mối quan hệ
            },
          },
          {
            status: 2, // Trạng thái là yêu cầu kết bạn
          },
          {
            client: { not: session.id },
          },
        ],
      },
      select: {
        id: true,
        friends: true,
        status: true,
        client: true,
        updatedAt: true,
      },
    });

    // Lấy danh sách id của người yêu cầu
    const requestUserIds = friendRequests.map((request) => request.client);
    // Truy vấn trong bảng User để lấy thông tin của người yêu cầu
    const requestUsers = await prisma.user.findMany({
      where: {
        id: {
          in: requestUserIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        bio: true,
        dob: true,
      },
    });

    // Kết hợp thông tin của người yêu cầu vào mỗi yêu cầu kết bạn
    const friendRequestsWithUser = friendRequests.map((request) => {
      const requestUser = requestUsers.find(
        (user) => user.id === request.client
      );
      return {
        ...request,
        friend: requestUser,
      };
    });

    res.status(200).json(friendRequestsWithUser);
  } catch (error) {
    res.status(500).json({ error: "Internal server error!" });
  }
};

exports.getAllFriendUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    // Lấy danh sách tất cả các bạn bè của người dùng hiện tại có trạng thái là bạn bè (status: 1)
    const friendsWithStatus = await prisma.relationship.findMany({
      where: {
        friends: { has: session.id }, // User hiện tại có trong danh sách bạn của mỗi mối quan hệ
        status: 1, // Trạng thái là bạn bè
      },
      select: {
        id: true, // ID của mỗi mối quan hệ
        friends: true, // Lấy danh sách bạn bè trong mỗi mối quan hệ
      },
    });

    // Lấy danh sách id của các bạn bè
    const friendIds = friendsWithStatus.flatMap(({ friends }) => {
      // Tìm id của bạn bè (khác với id của user hiện tại)
      return friends.filter((id) => id !== session.id);
    });

    // Lấy thông tin của các bạn bè từ danh sách id vừa tạo
    const friendsInfo = await prisma.user.findMany({
      where: {
        id: { in: friendIds },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        bio: true,
        dob: true,
      },
    });

    // Gắn thông tin về bạn bè và mối quan hệ vào kết quả trả về
    const friendsWithUserInfo = friendsInfo.map((friend) => {
      // Tìm mối quan hệ tương ứng với id bạn bè
      const relationship = friendsWithStatus.find((relationship) =>
        relationship.friends.includes(friend.id)
      );

      return {
        id: relationship.id, // ID của mối quan hệ
        friendId: friend.id, // ID của bạn bè
        status: 1, // Trạng thái là bạn bè
        friend: {
          id: friend.id,
          displayName: friend.displayName,
          email: friend.email,
          photoUrl: friend.photoUrl,
          bio: friend.bio,
          dob: friend.dob,
        }, // Thông tin về bạn bè
      };
    });

    res.status(200).json(friendsWithUserInfo);
  } catch (error) {
    res.status(500).json({ error: "server internal error !" });
  }
};

exports.removeFriend = async (req, res) => {
  const { prisma } = req.context;
  const { id } = req.body;

  try {
    // Cập nhật trạng thái của bản ghi Relationship có ID được cung cấp
    const updatedRelationshipRecord = await prisma.relationship.update({
      where: { id },
      data: { status: 0 },
    });

    res
      .status(200)
      .json({
        message: "Friend removed successfully",
        data: updatedRelationshipRecord,
      });
  } catch (error) {
    // Xử lý lỗi
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getFriendRequested = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    // Tìm các mối quan hệ mà người dùng hiện tại đã gửi lời mời kết bạn
    const friendRequests = await prisma.relationship.findMany({
      where: {
        friends: {
          has: session.id, // Người dùng hiện tại có trong danh sách bạn của mỗi mối quan hệ
        },
        status: 2, // Trạng thái là yêu cầu kết bạn
        client: session.id, // Người gửi yêu cầu là người dùng hiện tại
      },
      select: {
        id: true,
        friends: true,
        status: true,
        client: true,
        updatedAt: true,
      },
    });

    // Lấy danh sách id của người nhận lời mời kết bạn
    const requestUserIds = friendRequests.map((request) => {
      const friendId = request.friends.find((id) => id !== session.id); // Tìm id của người nhận yêu cầu
      return friendId;
    });

    // Truy vấn trong bảng User để lấy thông tin của người nhận yêu cầu kết bạn
    const requestUsers = await prisma.user.findMany({
      where: {
        id: {
          in: requestUserIds,
        },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        bio: true,
        dob: true,
      },
    });

    // Kết hợp thông tin của người nhận yêu cầu vào mỗi yêu cầu kết bạn
    const friendRequestsWithUser = friendRequests.map((request) => {
      const requestUser = requestUsers.find(
        (user) => user.id === request.friends.find((id) => id !== session.id)
      );
      return {
        ...request,
        friend: requestUser,
      };
    });

    res.status(200).json(friendRequestsWithUser);
  } catch (error) {
    res.status(500).json({ error: "Internal server error!" });
  }
};

exports.getListFriendUser = async (req, res) => {
  const { prisma, session } = req.context;
  try {
    // Lấy danh sách tất cả các bạn bè của người dùng hiện tại có trạng thái là bạn bè (status: 1)
    const friendsWithStatus = await prisma.relationship.findMany({
      where: {
        friends: { has: session.id }, // User hiện tại có trong danh sách bạn của mỗi mối quan hệ
        status: 1, // Trạng thái là bạn bè
      },
      select: {
        id: true, // ID của mỗi mối quan hệ
        friends: true, // Lấy danh sách bạn bè trong mỗi mối quan hệ
      },
    });

    // Lấy danh sách id của các bạn bè
    const friendIds = friendsWithStatus.flatMap(({ friends }) => {
      // Tìm id của bạn bè (khác với id của user hiện tại)
      return friends.filter((id) => id !== session.id);
    });

    // Lấy thông tin của các bạn bè từ danh sách id vừa tạo
    const friendsInfo = await prisma.user.findMany({
      where: {
        id: { in: friendIds },
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        photoUrl: true,
        bio: true,
        dob: true,
      },
    });

    // Gắn thông tin về bạn bè và mối quan hệ vào kết quả trả về
    const friendsWithUserInfo = friendsInfo.map((friend) => {
      // Tìm mối quan hệ tương ứng với id bạn bè

      return {
        id: friend.id,
        displayName: friend.displayName,
        email: friend.email,
        photoUrl: friend.photoUrl,
        bio: friend.bio,
        dob: friend.dob,
      };
    });

    res.status(200).json(friendsWithUserInfo);
  } catch (error) {
    res.status(500).json({ error: "server internal error !" });
  }
};
