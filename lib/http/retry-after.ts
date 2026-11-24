const MAX_RETRY_AFTER_MS=5*60_000;

export function parseRetryAfterMs(value:string|null,now=Date.now()):number|null{
  if(!value?.trim())return null;
  const normalized=value.trim();
  const seconds=Number(normalized);
  const milliseconds=Number.isFinite(seconds)&&seconds>=0
    ?seconds*1000
    :Date.parse(normalized)-now;
  if(!Number.isFinite(milliseconds)||milliseconds<0)return null;
  return Math.min(MAX_RETRY_AFTER_MS,milliseconds);
}
