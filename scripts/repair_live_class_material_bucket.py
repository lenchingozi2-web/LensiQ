"""Align the private lecture bucket with the parser's supported formats."""
import json
import os
import urllib.error
import urllib.request


def main():
    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    if base != 'https://hixvbcrrklyajhkyliay.supabase.co' or not key:
        raise RuntimeError('Expected Study Hub CI credentials are unavailable; no changes')
    url = base + '/storage/v1/bucket/ephemeral_class_materials'

    def request(body=None):
        data = json.dumps(body).encode() if body is not None else None
        headers = {'apikey': key, 'Authorization': 'Bearer '+key, 'Content-Type': 'application/json'}
        query = urllib.request.Request(url, data=data, headers=headers, method='PUT' if data else 'GET')
        try:
            with urllib.request.urlopen(query, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError('Lecture bucket request failed with HTTP '+str(error.code)) from None

    current = request()
    allowed = current.get('allowed_mime_types')
    required = {'application/json', 'application/msword'}
    if allowed is not None and not required.issubset(allowed):
        request({'id': current['id'], 'name': current['name'], 'public': False,
                 'file_size_limit': current.get('file_size_limit'),
                 'allowed_mime_types': sorted(set(allowed) | required)})
    verified = request()
    if verified.get('public') is not False:
        raise RuntimeError('The lecture bucket must remain private')
    types = verified.get('allowed_mime_types')
    if types is not None and not required.issubset(types):
        raise RuntimeError('Lecture navigation or legacy Word format is still blocked')
    print('PASS_PRIVATE_LECTURE_BUCKET_SUPPORTS_JSON_MAPS_AND_WORD', flush=True)


if __name__ == '__main__':
    main()
