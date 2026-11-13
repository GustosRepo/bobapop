import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { trackGameEvent } from '../analytics/gameAnalytics';

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    trackGameEvent('app_error', { message: error.message.slice(0, 300), component_stack: info.componentStack?.slice(0, 1000) });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={{ flex: 1, backgroundColor: '#2A0F05', padding: 32, justifyContent: 'center', gap: 20 }}>
      <Text style={{ color: '#FFF8EF', fontSize: 22 }}>BobaPop needs a fresh start.</Text>
      <Text style={{ color: '#FFF8EF', fontSize: 16 }}>Your saved progress is kept. Reopen the game to try again.</Text>
      <TouchableOpacity accessibilityRole="button" style={{ padding: 16, backgroundColor: '#8B4513', borderRadius: 12 }} onPress={() => this.setState({ failed: false })}>
        <Text style={{ color: '#FFF8EF', fontSize: 18 }}>Reopen game</Text>
      </TouchableOpacity>
    </View>;
  }
}
