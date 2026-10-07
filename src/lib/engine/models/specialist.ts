import type { Model, ModelFamily } from "../../../types/prediction";
/** A model that is registered but cannot run until its data feed exists. It abstains and says what it needs; it never guesses. */
const needs = (id: string, name: string, family: ModelFamily, need: string): Model => ({ id, name, family, needs: need, fit: () => null });
export const WAITING_MODELS: Model[] = [
  needs("gp-xg", "Gaussian Process Regression for xG", "machine-learning", "match expected goals (xG) history"),
  needs("quantile-xg", "Quantile Regression xG Model", "machine-learning", "match expected goals (xG) history"),
  needs("quantile-forest-xg", "Quantile Random Forest xG Model", "machine-learning", "match expected goals (xG) history"),
  needs("survival-first-goal", "Survival Time-to-First-Goal Model", "survival", "goal minute data for past matches"),
  needs("survival-next-goal", "Survival Time-to-Next-Goal Model", "survival", "goal minute data for past matches"),
  needs("cox-goal", "Cox Proportional Hazards Goal Model", "survival", "goal minute data for past matches"),
  needs("aft-goal", "Accelerated Failure Time Goal Model", "survival", "goal minute data for past matches"),
  needs("hawkes-events", "Hawkes Process Event Model", "survival", "timestamped match events"),
  needs("markov-score-state", "Markov Chain Score-State Model", "state-space", "in-match score timeline"),
  needs("player-team-graph", "Player-Team Graph Model", "specialist", "player lineups and minutes"),
  needs("set-piece", "Set-Piece Strength Model", "specialist", "set-piece statistics"),
  needs("referee-impact", "Referee Impact Model", "specialist", "referee assignments with card and penalty history"),
  needs("motivation-pressure", "Motivation and Table-Pressure Model", "specialist", "season table with matchday and fixtures remaining"),
  needs("derby-rivalry", "Derby and Rivalry Context Model", "specialist", "a curated rivalry list"),
  needs("manager-change", "Manager Change Impact Model", "specialist", "manager appointment history"),
  needs("squad-continuity", "Transfer and Squad Continuity Model", "specialist", "squad and transfer data"),
];
/** Catalogue entries left out on purpose, with the reason. They stay listed so the library is complete and the decision is visible. */
export const RETIRED: { id: string; name: string; reason: string }[] = [
  ["ordinal-random-forest", "Ordinal Random Forest", "Overlaps the Random Forest and Ordinal Logistic models."],
  ["gaussian-process-classifier", "Gaussian Process Classifier", "Behaves like k-Nearest Neighbours at a much higher fitting cost."],
  ["explainable-boosting-machine", "Explainable Boosting Machine", "Overlaps the Generalised Additive Model."],
  ["pls-da", "Partial Least Squares Discriminant Analysis", "Overlaps Linear Discriminant Analysis."],
  ["conditional-inference-forest", "Conditional Inference Forest", "Overlaps the Random Forest."],
  ["adaboost", "AdaBoost Classifier", "Overlaps the three boosted tree models."],
  ["histogram-gradient-boosting", "Histogram Gradient Boosting", "Same method family as the LightGBM style model."],
  ["ngboost", "NGBoost", "Overlaps the Poisson based goal models."],
  ["dirichlet-regression", "Dirichlet Regression", "For single match outcomes it reduces to multinomial logistic regression."],
  ["change-point-form", "Change-Point Form Model", "Overlaps the Kalman and dynamic linear models."],
  ["copula-goal-dependence", "Copula Goal-Dependence Model", "A wrapper; the Frank, Clayton and Gaussian copulas run on their own."],
  ["bart", "Bayesian Additive Regression Trees", "Overlaps the boosted and forest models."],
  ["bsts", "Bayesian Structural Time Series", "Overlaps the dynamic linear model."],
  ["gnn-team-interaction", "Graph Neural Network Team Interaction Model", "Overlaps PageRank and Massey ratings without player data."],
  ["schedule-similarity", "Schedule Similarity Retrieval Model", "Overlaps k-Nearest Neighbours."],
].map(([id, name, reason]) => ({ id, name, reason }));
