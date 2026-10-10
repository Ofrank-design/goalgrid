import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getLeagueModels } from "@/lib/engine/predictions";
import { LEAGUES } from "@/lib/simulation/server";
import { listProviders } from "@/lib/providers/registry";
import { GOALGRID_LIMITS } from "./limits";
const providerNames:Record<string,string>={sportmonks:"Sportmonks",footballData:"football-data.org",thestatsapi:"TheStatsAPI","goal-api":"GOAL API","big-balls":"Big Balls",oddsApi:"The Odds API",oddspapi:"OddsPapi",openweather:"OpenWeather",newsapi:"News API",serpapi:"SerpApi",resend:"Resend"};
export async function syncControlPlane(){const db=supabaseAdmin(), synced=[] as string[];for(const league of LEAGUES){try{const r=await getLeagueModels(league);const rows=r.registry.map(x=>({model_id:x.id,name:x.name,version:x.version,status:x.status,tier:x.family==='meta'?'A':x.status==='retired'?'D':['goals','rating','bayesian'].includes(x.family)?'A':x.status==='production'?'B':'C',purpose:x.purpose,owner:x.owner,training_dataset:x.trainingDataset,training_period:x.trainingPeriod,feature_version:x.featureVersion,supported_competitions:x.supportedCompetitions,supported_markets:x.supportedMarkets,required_features:x.requiredFeatures,minimum_sample_size:x.minimumTrainingSample,calibration_version:x.calibrationVersion,recent_performance:x.recentPerformance,calibration_score:x.calibrationScore,health_score:x.healthScore,compute_cost:x.computeCost,latency_cost:x.latencyCost,known_failure_modes:x.knownFailureModes,activated_at:x.activatedAt,retired_at:x.retiredAt,updated_at:new Date().toISOString()}));if(rows.length){const {error}=await db.from('model_registry').upsert(rows,{onConflict:'model_id'});if(error)throw new Error(error.message);}synced.push(league);}catch{}}
 const resourceRows=[
  {key:"model.candidate_max",max_value:GOALGRID_LIMITS.model.candidateMaxModels,window_seconds:null,scope:"global",note:"Maximum candidate models executed per ensemble build."},
  {key:"model.active_max",max_value:GOALGRID_LIMITS.model.activeMaxModels,window_seconds:null,scope:"global",note:"Maximum active models contributing to a prediction."},
  {key:"simulation.concurrent_per_user",max_value:GOALGRID_LIMITS.simulation.maxConcurrentRuns,window_seconds:null,scope:"user",note:"Maximum concurrent simulation requests per user."},
  {key:"system.max_job_duration_ms",max_value:GOALGRID_LIMITS.system.maxJobDuration,window_seconds:null,scope:"job",note:"Application job ceiling."},
  {key:"system.max_queue_depth",max_value:GOALGRID_LIMITS.system.maxQueueDepth,window_seconds:null,scope:"global",note:"Queue depth alert threshold."},
 ]; await db.from("resource_limits").upsert(resourceRows.map(r=>({...r,updated_at:new Date().toISOString()})),{onConflict:"key"});
 const {data:health}=await db.from('provider_health').select('provider,status,latency_ms,last_ok_at,last_error_kind,updated_at');for(const h of health??[]){const id=String(h.provider),status=h.status==='ok'?'ok':h.status==='down'?'down':'degraded';await db.from('provider_registry').upsert({provider_id:id,name:providerNames[id]??id,kind:id, status, latency_ms:h.latency_ms,last_ok_at:h.last_ok_at, last_error_at:h.last_error_kind?h.updated_at:null, quota_note:h.last_error_kind?String(h.last_error_kind):null,updated_at:new Date().toISOString()},{onConflict:'provider_id'});}
 return {syncedLeagues:synced,providers:listProviders()};}
