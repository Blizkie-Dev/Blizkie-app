import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Animated,
  Dimensions,
  Easing,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  createNavigatorFactory,
  useNavigationBuilder,
  TabRouter,
} from '@react-navigation/native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStackNavigator } from '@react-navigation/stack';
import ChatsListScreen from '../screens/main/ChatsListScreen';
import ChatScreen from '../screens/main/ChatScreen';
import SearchUsersScreen from '../screens/main/SearchUsersScreen';
import CreateGroupScreen from '../screens/main/CreateGroupScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { useColors } from '../hooks/useColors';

const SCREEN_W = Dimensions.get('window').width;
const ChatsStack = createStackNavigator();
const ProfileStack = createStackNavigator();

function ChatsStackNavigator() {
  const C = useColors();
  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: C.background, shadowColor: '#00000015' },
    headerTintColor: C.primary,
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: C.backgroundSecondary },
  }), [C]);

  return (
    <ChatsStack.Navigator screenOptions={screenOptions}>
      <ChatsStack.Screen name="ChatsList" component={ChatsListScreen} options={{ title: 'Blizkie' }} />
      <ChatsStack.Screen name="Chat" component={ChatScreen as any} options={{ title: '', gestureEnabled: true }} />
      <ChatsStack.Screen name="SearchUsers" component={SearchUsersScreen} options={{ title: 'Новый чат' }} />
      <ChatsStack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'Новая группа' }} />
    </ChatsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  const C = useColors();
  const screenOptions = useMemo(() => ({
    headerStyle: { backgroundColor: C.background, shadowColor: '#00000015' },
    headerTintColor: C.text,
    headerBackTitleVisible: false,
  }), [C]);

  return (
    <ProfileStack.Navigator screenOptions={screenOptions}>
      <ProfileStack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Мой профиль' }} />
    </ProfileStack.Navigator>
  );
}

// ─── Custom Pager Navigator ──────────────────────────────────────────────────

function PagerNavigatorView({ state, navigation, descriptors }: any) {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(C), [C]);

  // Two separate values so JS always knows pagePos exactly (no flattenOffset sync issues).
  // gestureOffset is native-tracked; pagePos is JS-animated.
  // Visual = Animated.add(pagePos, gestureOffset).
  const pagePos = useRef(new Animated.Value(0)).current;
  const gestureOffset = useRef(new Animated.Value(0)).current;
  const combined = useRef(Animated.add(pagePos, gestureOffset)).current;

  const activePageRef = useRef<number>(state.index);
  // Guards against useEffect double-animating when our own gesture already started one.
  // Only set true when navigate() will actually fire (i.e. target !== current state.index),
  // so the flag is always cleared by the corresponding useEffect invocation.
  const suppressEffect = useRef(false);

  // Disable pager swipe when the user is inside a pushed stack screen (e.g. ChatScreen),
  // so the iOS swipe-back gesture of the stack navigator is not stolen.
  const chatsStackDepth = (state.routes[0]?.state as any)?.index ?? 0;
  const pagerGestureEnabled = state.index !== 0 || chatsStackDepth === 0;

  // Sync animation when navigation changes externally (deep-link, tab bar, etc.)
  useEffect(() => {
    if (suppressEffect.current) {
      suppressEffect.current = false;
      return;
    }
    activePageRef.current = state.index;
    Animated.timing(pagePos, {
      toValue: -state.index * SCREEN_W,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [state.index]);

  const clampedX = combined.interpolate({
    inputRange: [-SCREEN_W, 0],
    outputRange: [-SCREEN_W, 0],
    extrapolate: 'clamp',
  });

  // Only gestureOffset is driven by native Animated.event.
  // pagePos is never touched by the gesture itself, so JS always knows its exact value.
  const handleGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: gestureOffset } }],
    { useNativeDriver: true },
  );

  // Button-tap: smooth ease-out timing
  function snapToRoute(routeIndex: number) {
    activePageRef.current = routeIndex;
    Animated.timing(pagePos, {
      toValue: -routeIndex * SCREEN_W,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    // Only suppress + navigate when state actually needs to change.
    // If already on this tab, navigate() is a no-op and useEffect never fires,
    // which would leave suppressEffect stuck at true forever.
    if (state.index !== routeIndex) {
      suppressEffect.current = true;
      navigation.navigate(state.routes[routeIndex].name);
    }
  }

  // Gesture release: spring continues from the finger's actual velocity.
  // RNGH gives velocity in px/s; RN spring internal physics expects px/ms → divide by 1000.
  function snapToRouteWithVelocity(routeIndex: number, velocityX: number) {
    activePageRef.current = routeIndex;
    Animated.spring(pagePos, {
      toValue: -routeIndex * SCREEN_W,
      velocity: velocityX / 1000,
      tension: 60,
      friction: 14,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
    if (state.index !== routeIndex) {
      suppressEffect.current = true;
      navigation.navigate(state.routes[routeIndex].name);
    }
  }

  const handleStateChange = ({ nativeEvent }: any) => {
    const { state: gestureState, translationX, velocityX } = nativeEvent;

    if (gestureState === State.BEGAN) {
      // Ensure gestureOffset starts clean for this gesture
      gestureOffset.setValue(0);
    } else if (gestureState === State.END) {
      // Commit finger position into pagePos and reset gestureOffset.
      // Both setValue calls are synchronous → processed in the same native frame → no flash.
      pagePos.setValue(-activePageRef.current * SCREEN_W + translationX);
      gestureOffset.setValue(0);
      let target = activePageRef.current;
      if (activePageRef.current === 0 && (translationX < -SCREEN_W * 0.35 || velocityX < -500)) {
        target = 1;
      } else if (activePageRef.current === 1 && (translationX > SCREEN_W * 0.35 || velocityX > 500)) {
        target = 0;
      }
      snapToRouteWithVelocity(target, velocityX);
    } else if (gestureState === State.CANCELLED || gestureState === State.FAILED) {
      pagePos.setValue(-activePageRef.current * SCREEN_W + translationX);
      gestureOffset.setValue(0);
      Animated.spring(pagePos, {
        toValue: -activePageRef.current * SCREEN_W,
        velocity: velocityX / 1000,
        tension: 60,
        friction: 14,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
    }
  };

  const tabBarHeight = 50 + insets.bottom;

  return (
    <View style={styles.root}>
      <View style={styles.clipContainer}>
        <PanGestureHandler
          enabled={pagerGestureEnabled}
          onGestureEvent={handleGestureEvent}
          onHandlerStateChange={handleStateChange}
          activeOffsetX={[-15, 15]}
          failOffsetY={[-12, 12]}
        >
          <Animated.View style={[styles.pager, { transform: [{ translateX: clampedX }] }]}>
            {state.routes.map((route: any) => (
              <View key={route.key} style={styles.page}>
                {descriptors[route.key].render()}
              </View>
            ))}
          </Animated.View>
        </PanGestureHandler>
      </View>

      <View style={[styles.tabBar, { backgroundColor: C.background, borderTopColor: C.border, height: tabBarHeight, paddingBottom: insets.bottom }]}>
        {state.routes.map((route: any, i: number) => {
          const active = state.index === i;
          const icon = i === 0 ? '💬' : '👤';
          const label = i === 0 ? 'Чаты' : 'Профиль';
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={() => snapToRoute(i)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, { color: active ? C.primary : C.textSecondary }]}>{icon}</Text>
              <Text style={[styles.tabLabel, { color: active ? C.primary : C.textSecondary }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PagerNavigatorComponent({ children, screenOptions, initialRouteName }: any) {
  const { state, navigation, descriptors, NavigationContent } = useNavigationBuilder(TabRouter, {
    children,
    screenOptions,
    initialRouteName,
  });

  return (
    <NavigationContent>
      <PagerNavigatorView state={state} navigation={navigation} descriptors={descriptors} />
    </NavigationContent>
  );
}

const createPagerNavigator = createNavigatorFactory(PagerNavigatorComponent);
const Pager = createPagerNavigator();

// ─── Main Navigator ──────────────────────────────────────────────────────────

export default function MainNavigator() {
  return (
    <Pager.Navigator initialRouteName="Chats">
      <Pager.Screen name="Chats" component={ChatsStackNavigator} />
      <Pager.Screen name="Profile" component={ProfileStackNavigator} />
    </Pager.Navigator>
  );
}

const createStyles = (C: ReturnType<typeof import('../hooks/useColors').useColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    clipContainer: {
      flex: 1,
      overflow: 'hidden',
    },
    pager: {
      flex: 1,
      flexDirection: 'row',
      width: SCREEN_W * 2,
    },
    page: {
      width: SCREEN_W,
      overflow: 'hidden',
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: 6,
    },
    tabIcon: {
      fontSize: 22,
    },
    tabLabel: {
      fontSize: 11,
      marginTop: 2,
    },
  });
