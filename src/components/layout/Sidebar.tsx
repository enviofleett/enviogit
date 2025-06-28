
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Monitor, 
  MapPin, 
  Settings, 
  Bell, 
  Database, 
  Zap,
  Shield,
  Users
} from 'lucide-react';

const navigation = [
  { name: 'Fleet Overview', href: '/', icon: Monitor },
  { name: 'Live Tracking', href: '/tracking', icon: MapPin },
  { name: 'Maintenance', href: '/maintenance', icon: Settings },
  { name: 'Geofencing', href: '/geofencing', icon: Shield },
  { name: 'Analytics', href: '/analytics', icon: Database },
  { name: 'Alerts', href: '/alerts', icon: Bell },
  { name: 'Drivers', href: '/drivers', icon: Users },
  { name: 'AI Insights', href: '/insights', icon: Zap },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-5 bg-slate-900 overflow-y-auto">
        <div className="flex items-center flex-shrink-0 px-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">FleetSense AI</h1>
          </div>
        </div>
        <div className="mt-8 flex-grow flex flex-col">
          <nav className="flex-1 px-2 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`${
                    isActive
                      ? 'bg-slate-800 text-blue-400 border-r-2 border-blue-400'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  } group flex items-center px-2 py-2 text-sm font-medium rounded-l-md transition-all duration-200`}
                >
                  <Icon
                    className={`${
                      isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-300'
                    } mr-3 flex-shrink-0 h-5 w-5`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
