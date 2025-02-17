import * as followDao from "../database/follow/follow-dao.js";
import * as likeDao from "../database/like/like-dao.js";
import * as commentDao from "../database/comment/comment-dao.js";
import * as albumDao from "../database/album/album-dao.js";
import * as artistDao from "../database/artist/artist-dao.js";
import * as playlistDao from "../database/playlist/playlist-dao.js";
import * as trackDao from "../database/track/track-dao.js";
import * as showDao from "../database/show/show-dao.js";
import * as episodeDao from "../database/episode/episode-dao.js";

const CONTENT_SIZE = 50;

const getAnonymousContent = async (req, res) => {

    const posts = []
    await generateAnonymousContent(posts, CONTENT_SIZE);

    res.json({posts});

}

const getNonAnonymousContent = async (req, res) => {

    const user_id = req.params.user_id;

    const userLikes = await likeDao.getLikesByUser(user_id);
    const userComments = await commentDao.getCommentsByUser(user_id);

    // use follow dao to find users that the given user is following and select the most recent 5 likes/
    // comments for that user
    const following = await followDao.getFollowing(user_id);
    const likes = [];
    const comments = [];
    const likeCommentPromises = [];

    for (const f of following) {
        const promise = getLikeCommentData(f, likes, comments);
        likeCommentPromises.push(promise);
    }

    await Promise.all(likeCommentPromises);

    const combined = [...userLikes, ...userComments, ...likes, ...comments];
    const combinedTotal = combined.sort((a, b) => b.timestamp - a.timestamp)



    const noDuplicates = Array.from(new Set(combinedTotal.map(a => a.post_id)))
        .map(id => {
            return combinedTotal.find(a => a.post_id === id)
        })

    let posts = [];
    const postPromises = [];

    for (const v of noDuplicates) {
        const promise = getPostData(v, posts);
        postPromises.push(promise);
    }

    if (noDuplicates.length < CONTENT_SIZE) {
        await generateAnonymousContent(posts, CONTENT_SIZE - noDuplicates.length);
    }

    await Promise.all(postPromises);

    posts = Array.from(new Set(posts.map(a => a.post_id)))
        .map(id => {
            return posts.find(a => a.post_id === id)
        })

    if (posts.length > CONTENT_SIZE) {
        posts = posts.slice(0, CONTENT_SIZE);
    }

    res.json({posts});
}

const generateAnonymousContent = async (posts, length) => {
    // collect post ids and content type from comment/like daos
    let likes = await likeDao.getRecentLikes();
    let comments = await commentDao.getRecentComments();

    let combined = [
        ...likes,
        ...comments
    ]

    combined = Array.from(new Set(combined.map(a => a.post_id)))
        .map(id => {
            return combined.find(a => a.post_id === id)
        })

    combined = combined.sort((a, b) => b.timestamp - a.timestamp)

    if (combined.length > length) {
        combined = combined.slice(0, length);
    }

    const promises = [];

    for (const v of combined) {
        const promise = getPostData(v, posts);
        promises.push(promise);
    }

    await Promise.all(promises);
}

const getPostData = async (v, posts) => {
    let result = null;
    const postLikes = await likeDao.getLikesByPost(v.post_id);
    const likeCount = postLikes.length;

    const postComments = await commentDao.getCommentsByPost(v.post_id);
    const commentCount = postComments.length;

    switch(v.type) {
        case "track":
            result = await trackDao.getPost(v.post_id);
            break;
        case "album":
            result = await albumDao.getPost(v.post_id);
            break;
        case "artist":
            result = await artistDao.getPost(v.post_id);
            break;
        case "show":
            result = await showDao.getPost(v.post_id);
            break;
        case "episode":
            result = await episodeDao.getPost(v.post_id);
            break;
        case "playlist":
            result = await playlistDao.getPost(v.post_id);
            break;
    }

    if (result !== null) {
        posts.push({
            ...result._doc,
            type: v.type,
            likes: likeCount,
            comments: commentCount
        });
    }
}

const getLikeCommentData = async(f, likes, comments) => {
    const id = f.followee_id;
    const followerLikes = await likeDao.getLikesByUser(id);
    const followerComments = await commentDao.getCommentsByUser(id);
    likes.push(...followerLikes);
    comments.push(...followerComments)
}

const contentController = (app) => {
    app.get('/content', getAnonymousContent);
    app.get('/content/:user_id', getNonAnonymousContent);
}

export default contentController;