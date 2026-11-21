"""Check the exact new voice and medical renderer before replacing the running worker."""
import asyncio
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'worker/lensiq-voice-tutor'))
from agent import build_tts
from medical_speech import medical_speech

async def main():
    tts=build_tts()
    total=clipped=audible=0
    try:
        async with tts.synthesize(medical_speech('Pharmacokinetics describes drug movement through the body. A hypothetical dose is 0.5 mg. Adenocarcinoma is a gland-forming cancer.')) as stream:
            async for packet in stream:
                samples=list(packet.frame.data)
                total+=len(samples);clipped+=sum(abs(n)>=32760 for n in samples)
                if any(abs(n)>200 for n in samples):audible+=1
        if audible<5 or not total:raise RuntimeError('Candidate voice produced no usable speech')
        if clipped/total>.005:raise RuntimeError('Candidate voice has excessive digital clipping')
        print('PASS candidate instructional voice and medical rendering: decoded audio, clipping fraction '+str(round(clipped/total,6)),flush=True)
    finally:await tts.aclose()
asyncio.run(main())
