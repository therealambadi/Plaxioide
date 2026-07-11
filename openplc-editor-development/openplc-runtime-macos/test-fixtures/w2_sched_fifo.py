import sys
path = 'core/src/plc_app/plc_state_manager.cpp'
src = open(path).read()
old = ('    sched_param param;\n'
       '    param.sched_priority = sched_get_priority_max(SCHED_FIFO);\n'
       '    pthread_setschedparam(pthread_self(), SCHED_FIFO, &param);')
new = ('#ifndef __MSYS__\n'
       '    sched_param param;\n'
       '    param.sched_priority = sched_get_priority_max(SCHED_FIFO);\n'
       '    pthread_setschedparam(pthread_self(), SCHED_FIFO, &param);\n'
       '#endif')
if old in src:
    open(path, 'w').write(src.replace(old, new))
    print('W2: OK')
else:
    print('W2: anchor not found or already applied', file=sys.stderr)
