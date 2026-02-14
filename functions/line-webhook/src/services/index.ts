export {analyzeMeal, NotFoodError} from "./mealAnalyzer";
export {generateBearImage} from "./bearGenerator";
export {uploadImage, downloadImageAsBase64} from "./storage";
export {saveBear, getLatestBear} from "./bearRepository";
export {saveMeal, getRecentMeals, getMealCount} from "./mealRepository";
export {generateVideoFromBears} from "./videoGenerator";
export {reincarnate, getActiveGroup} from "./bearGroupRepository";
export {
  getEmbedding,
  getTagsEmbedding,
  cosineSimilarity,
  detectTrendStrength,
  averageEmbedding,
} from "./embeddingService";
