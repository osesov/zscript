script -efc "socat -v -x tcp-l:2009,fork,reuseaddr tcp:127.0.0.1:2008" session.log
