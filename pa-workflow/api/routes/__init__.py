# API Route Definitions
try:
    from . import auth_routes
    from . import pa_routes
    __all__ = ['auth_routes', 'pa_routes']
except ImportError:
    # If pa_routes has import issues, still export auth_routes
    from . import auth_routes
    __all__ = ['auth_routes']
