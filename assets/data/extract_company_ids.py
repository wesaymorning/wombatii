import sys
import re

filename = sys.argv[1]

print(f'filename:{filename}')

fh = open(filename, 'r')

#const companyIdentifiers: Record<string, string> = {
#  alice: 25,
#  bob: 30
#};

key = ''
value = ''

outo = open('company_identifiers.tsx', 'w')

outo.write('const companyIdentifiers: Record<string, string> = {\n')

#  - value: 0x10CC
#    name: 'Linde GmbH'

for line in fh:

    key_s_obj = re.search(r'value:\s+0x([x\dABCDEF]+)', line)
    value_s_obj = re.search(r'name:\s(.+)', line)

    if key_s_obj:
        key = key_s_obj.group(1).lower()
    elif value_s_obj:
        value = value_s_obj.group(1)

        print(f'{key} -> {value}')

        outo.write(f'\t"{key}": {value},\n')

fh.close()
outo.write('}\n\nexport default companyIdentifiers\n')
outo.close()




