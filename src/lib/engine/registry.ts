import { LEAGUE_REGISTRY } from "@/lib/football/league-registry";
import { ALL_MODELS, type Ensemble } from "./models/ensemble";
import { RETIRED } from "./models/specialist";
import type { ModelFamily } from "@/types/prediction";
export type RegistryStatus = "research" | "shadow" | "candidate" | "production" | "degraded" | "retired";
export interface RegistryEntry {
  id: string; name: string; version: string; family: ModelFamily | "meta"; kind: "base" | "meta"; status: RegistryStatus;
  health: "healthy" | "degraded" | "unavailable"; purpose: string | null; owner: string | null; trainingDataset: string | null; trainingPeriod: string | null;
  featureVersion: string | null; supportedCompetitions: string[]; supportedMarkets: string[]; requiredFeatures: string[]; minimumTrainingSample: number;
  calibrationVersion: string | null; recentPerformance: Record<string, number | null>; calibrationScore: number | null; healthScore: number | null;
  computeCost: number | null; latencyCost: number | null; knownFailureModes: string[]; producesScoreMatrix: boolean; lastTrainedAt: string | null;
  validated: boolean; logLoss: number | null; weight: number; note: string | null; createdAt: string; activatedAt: string | null; retiredAt: string | null;
}
const MIN_SAMPLE: Partial<Record<ModelFamily, number>> = { "machine-learning": 150, "deep-learning": 150, "state-space": 60, goals: 30, bayesian: 30, rating: 30, copula: 100 };
const COMPETITIONS: string[] = LEAGUE_REGISTRY.map(l => l.slug);
const failureModes = (note: string | null) => note ? [note] : [];
const pctHealth = (x: { status?: string; logLoss?: number | null; testMatches?: number } | undefined) => !x ? null : x.status === "tested" ? Math.max(0, Math.min(1, 1 - Math.min(Number(x.logLoss ?? 1), 1))) : x.status === "degraded" ? 0.35 : 0.2;
type BaseEntry = Pick<RegistryEntry,"status"|"health"|"producesScoreMatrix"> & { calibrated: boolean };
const base = (model:(typeof ALL_MODELS)[number], x:Ensemble["metrics"][number]|undefined, e:Ensemble, entry:BaseEntry):RegistryEntry => ({
  id:model.id,name:model.name,version:"1.0.0",family:model.family,kind:"base",status:entry.status,health:entry.health,
  purpose:model.about??null,owner:"GoalGrid Research",trainingDataset:"league historical match results",trainingPeriod:`through ${e.builtAt}`,
  featureVersion:"history-v1",supportedCompetitions:COMPETITIONS,supportedMarkets:entry.producesScoreMatrix?["1X2","BTTS","Over/Under 2.5"]:["1X2"],
  requiredFeatures:String(model.needs??"match history").split(/,|;| and /).map(s=>s.trim()).filter(Boolean),minimumTrainingSample:MIN_SAMPLE[model.family as ModelFamily]??30,
  calibrationVersion:entry.calibrated?"cross-fit-1.0":null,recentPerformance:{logLoss:x?.logLoss??null,brier:x?.brier??null,testMatches:x?.testMatches??0},
  calibrationScore:entry.calibrated?Number((x?.brier??0).toFixed(4)):null,healthScore:pctHealth(x),computeCost:model.heavy?1:0.5,latencyCost:model.heavy?1:0.5,
  knownFailureModes:failureModes(x?.note??model.needs??null),producesScoreMatrix:entry.producesScoreMatrix,lastTrainedAt:entry.status==="research"?null:e.builtAt,validated:x?.status==="tested",logLoss:x?.logLoss??null,weight:x?.weight??0,
  note:x?.note??model.about??null,createdAt:e.builtAt,activatedAt:entry.status==="production"?e.builtAt:null,retiredAt:null,
});
export function buildRegistry(e: Ensemble): RegistryEntry[] {
  const metrics=new Map(e.metrics.map(x=>[x.id,x])),mat=new Set(e.matrixIds),out:RegistryEntry[]=[];
  for(const model of ALL_MODELS){
    const x=metrics.get(model.id);
    const status: RegistryStatus = !x || x.status === "waiting" ? "research" : x.status === "degraded" ? "degraded" : x.status === "shadow" ? "shadow" : x.status === "unvalidated" ? "candidate" : "production";
    const producesScoreMatrix=mat.has(model.id);
    out.push(base(model,x,e,{status,health:status==="degraded"?"degraded":(status==="research"||status==="shadow"||status==="candidate")?"unavailable":"healthy",producesScoreMatrix,calibrated:Boolean(x?.calibrated)}));
  }
  out.push({id:"stacked-meta-learner",name:"Stacked Meta-Learner",version:"1.0.0",family:"meta",kind:"meta",status:e.stack?"production":"shadow",health:e.stack?"healthy":"unavailable",purpose:"Combines held-out model-family predictions when stacking beats the weighted ensemble.",owner:"GoalGrid Research",trainingDataset:"held-out league match predictions",trainingPeriod:e.stack?`through ${e.builtAt}`:null,featureVersion:"ensemble-v1",supportedCompetitions:COMPETITIONS,supportedMarkets:["1X2"],requiredFeatures:["held-out predictions"],minimumTrainingSample:100,calibrationVersion:null,recentPerformance:{logLoss:e.stack?.llStacked??null},calibrationScore:null,healthScore:e.stack?1:0.2,computeCost:1,latencyCost:1,knownFailureModes:e.stack?[]:["Not selected because held-out evidence was insufficient or weaker"],producesScoreMatrix:false,lastTrainedAt:e.stack?e.builtAt:null,validated:!!e.stack,logLoss:e.stack?.llStacked??null,weight:e.stack?.theta.reduce((a,b)=>a+b,0)??0,note:e.stack?"Production meta component.":"Shadow component.",createdAt:e.builtAt,activatedAt:e.stack?e.builtAt:null,retiredAt:null});
  out.push({id:"conformal-wrapper",name:"Conformal Prediction Wrapper",version:"1.0.0",family:"meta",kind:"meta",status:e.conformal?"production":"shadow",health:e.conformal?"healthy":"unavailable",purpose:"Produces a calibrated set of plausible match outcomes from held-out ensemble predictions.",owner:"GoalGrid Research",trainingDataset:"held-out ensemble predictions",trainingPeriod:e.conformal?`through ${e.builtAt}`:null,featureVersion:"ensemble-v1",supportedCompetitions:COMPETITIONS,supportedMarkets:["1X2"],requiredFeatures:["held-out ensemble predictions"],minimumTrainingSample:100,calibrationVersion:"conformal-1.0",recentPerformance:{coverage:e.conformal?1-e.conformal.alpha:null,averageSetSize:e.conformal?.avgSetSize??null},calibrationScore:e.conformal?1-e.conformal.alpha:null,healthScore:e.conformal?1:0.2,computeCost:0.4,latencyCost:0.2,knownFailureModes:e.conformal?[]:["Not enough held-out matches"],producesScoreMatrix:false,lastTrainedAt:e.conformal?e.builtAt:null,validated:!!e.conformal,logLoss:null,weight:0,note:e.conformal?`Target coverage ${Math.round((1-e.conformal.alpha)*100)}%.`:"Shadow component.",createdAt:e.builtAt,activatedAt:e.conformal?e.builtAt:null,retiredAt:null});
  for(const r of RETIRED)out.push({id:r.id,name:r.name,version:"-",family:"specialist",kind:"base",status:"retired",health:"unavailable",purpose:"Retired research catalogue entry",owner:"GoalGrid Research",trainingDataset:null,trainingPeriod:null,featureVersion:null,supportedCompetitions:COMPETITIONS,supportedMarkets:["1X2"],requiredFeatures:[],minimumTrainingSample:0,calibrationVersion:null,recentPerformance:{},calibrationScore:null,healthScore:0,computeCost:null,latencyCost:null,knownFailureModes:[r.reason],producesScoreMatrix:false,lastTrainedAt:null,validated:false,logLoss:null,weight:0,note:r.reason,createdAt:e.builtAt,activatedAt:null,retiredAt:e.builtAt});
  return out;
}
