#!/usr/bin/env python3

import os, sys, json, struct, subprocess, re

# Read a message from stdin and decode it.
def getMessage():
    rawLength = sys.stdin.buffer.read(4)
    if len(rawLength) == 0:
        sys.exit(0)
    messageLength = struct.unpack('@I', rawLength)[0]
    message = sys.stdin.buffer.read(messageLength).decode("utf-8")
    debugLog('>', message)
    return json.loads(message)

# Encode a message for transmission, given its content.
def encodeMessage(messageContent):
    encodedContent = json.dumps(messageContent)
    encodedLength = struct.pack('@I', len(encodedContent))
    return {'length': encodedLength, 'content': encodedContent}

# Send an encoded message to stdout.
def sendMessage(encodedMessage):
    debugLog('<', encodedMessage['content'])
    sys.stdout.buffer.write(encodedMessage['length'])
    sys.stdout.write(encodedMessage['content'])
    sys.stdout.flush()

def debugLog(mtype, text):
    if logfile != None:
        logfile.write(mtype + ' ')
        logfile.write(text)
        logfile.write('\n')

logfile = None
#logfile = open('passff_py.log', 'a')

receivedMessage = getMessage()
env = dict(os.environ)
if "HOME" not in env:
    env["HOME"] = os.path.expanduser('~')
if receivedMessage['command'][-4:] == "pass" or receivedMessage['command'][-8:] == "bash.exe":
    for key, val in receivedMessage['environment'].items():
        env[key] = val
    cmd = [receivedMessage['command']] + receivedMessage['arguments']
    proc_params = {
        'stdout': subprocess.PIPE,
        'stderr': subprocess.PIPE,
        'env': env
    }
    if 'stdin' in receivedMessage:
      proc_params['stdin'] = subprocess.PIPE
    debugLog('*', json.dumps(cmd))
    proc = subprocess.Popen(cmd, **proc_params)
    if 'stdin' in receivedMessage:
      proc_in = bytes(receivedMessage['stdin'], receivedMessage['charset'])
      proc_out, proc_err = proc.communicate(input=proc_in)
    else:
      proc_out, proc_err = proc.communicate()
    sendMessage(encodeMessage({
        "exitCode": proc.returncode,
        "stdout": proc_out.decode(receivedMessage['charset']),
        "stderr": proc_err.decode(receivedMessage['charset']),
        "other": ""
    }))
elif receivedMessage['command'] == "env":
    sendMessage(encodeMessage(env))
elif receivedMessage['command'] == "gpgAgentEnv":
    gpgAgentEnv = {}
    if "GNOME_KEYRING_CONTROL" in env:
        gpgAgentEnv['GNOME_KEYRING_CONTROL'] = env['GNOME_KEYRING_CONTROL']
    else:
        gpgAgentEnv['GNOME_KEYRING_CONTROL'] = ""

    gpgAgentInfo = receivedMessage['arguments'][0]
    if os.path.isabs(gpgAgentInfo):
        filename = gpgAgentInfo
    else:
        filename = os.path.join(env['HOME'], gpgAgentInfo)

    try:
        with open(filename, 'r') as f:
            pattern = r'^([^=]+)=([^;]+)'
            for line in f.readlines():
                match = re.search(pattern, line)
                if match:
                    key = match.group(1).strip()
                    val = match.group(2).strip()
                    gpgAgentEnv[key] = val
    except:
        if "GPG_AGENT_INFO" in env:
            gpgAgentEnv['GPG_AGENT_INFO'] = env['GPG_AGENT_INFO']
        else:
            gpgAgentEnv['GPG_AGENT_INFO'] = ""
    sendMessage(encodeMessage(gpgAgentEnv))

