def get_congestion_level(waiting_time):
    if waiting_time<20:
        return "LOW"
    elif waiting_time<40:
        return "MEDIUM"
    else:
        return "HIGH"