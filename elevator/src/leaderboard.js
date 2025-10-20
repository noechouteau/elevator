import Axis from "axis-api";

export default class Leaderboard {
    constructor() {
        this.leaderboard = null;
        this.createLeaderboard();
    }

    createLeaderboard() {
          this.leaderboard = Axis.createLeaderboard({
            id: import.meta.env.VITE_GLOBALGAME_ID,
        });
        console.log(this.leaderboard);
    }

    async PostScore(score, name, gameID) {
        try {
            this.leaderboard.postScore({
                username: name,
                gameID: gameID,
                value: score,
            })
            .then(() => {
                leaderboard.getScores().then((response) => {
                    this.scores = response;
                });
            });
        } catch (error) {
            console.error("Error posting score to leaderboard:", error);
            throw error;
        }
    }

    async getScores() {
        try {
            const scores = await this.leaderboard.getScores();
            return scores;
        } catch (error) {
            console.error("Error fetching leaderboard scores:", error);
            throw error;
        }
    }
    
    filterTopScores(scores, topN = 10) {
        return scores
            .sort((a, b) => b.value - a.value)
            .slice(0, topN);
    }
}

const leaderboard = new Leaderboard();

const sendScore = async (score, name, gameId) => {
    return await leaderboard.PostScore(score, name, gameId);
};

// sendScore(2000, "TestPlayer");

// const postScore = await leaderboard.PostScore(5000, "PlayerOne", "game123");
const scores = await leaderboard.getScores();
// const filteredScores = leaderboard.filterTopScores(scores, 5);
console.log(scores);