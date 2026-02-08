import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/src/ui/components';
import { border, color, elevation, radius, space, spacing, touchTarget } from '@/src/ui/tokens';

const BAR_HEIGHT = spacing[32] + spacing[24] + spacing[8];

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={[styles.wrap, { bottom: Math.max(insets.bottom + space.controlGap, space.pageX) }]}>
        <View style={styles.bar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const iconColor = isFocused ? color.accent : color.textSecondary;
            const label =
              typeof options.tabBarLabel === 'string'
                ? options.tabBarLabel
                : typeof options.title === 'string'
                  ? options.title
                  : route.name;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                onPress={onPress}
                onLongPress={onLongPress}
                style={({ pressed }) => [
                  styles.item,
                  isFocused ? styles.itemActive : null,
                  pressed ? styles.itemPressed : null,
                ]}
              >
                <View style={[styles.iconWrap, isFocused ? styles.iconWrapActive : null]}>
                  {options.tabBarIcon
                    ? options.tabBarIcon({
                        focused: isFocused,
                        color: iconColor,
                        size: spacing[20],
                      })
                    : null}
                </View>
                <Text variant="caption" tone={isFocused ? 'accent' : 'secondary'} compact style={styles.tabLabel}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const contentBottomPadding = BAR_HEIGHT + Math.max(insets.bottom + space.sectionGap * 2, space.pageBottom * 2);

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          paddingBottom: contentBottomPadding,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color: iconColor, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={iconColor} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: 'Record',
          tabBarIcon: ({ color: iconColor, size, focused }) => (
            <Ionicons name={focused ? 'mic' : 'mic-outline'} color={iconColor} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color: iconColor, size, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} color={iconColor} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color: iconColor, size, focused }) => (
            <Ionicons name={focused ? 'analytics' : 'analytics-outline'} color={iconColor} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color: iconColor, size, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={iconColor} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.pageX + space.compactGap,
    right: space.pageX + space.compactGap,
  },
  bar: {
    height: BAR_HEIGHT,
    backgroundColor: color.surface,
    borderRadius: radius.xxl,
    borderWidth: border.width,
    borderColor: color.border,
    paddingHorizontal: space.compactGap,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: color.navShadow,
    shadowOpacity: elevation.navOpacity,
    shadowRadius: elevation.shadowRadius + 4,
    shadowOffset: {
      width: 0,
      height: spacing[4],
    },
    elevation: elevation.android + 1,
  },
  item: {
    flex: 1,
    minHeight: touchTarget.min + space.cardGap,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.compactGap / 2,
  },
  itemActive: {
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: touchTarget.min - spacing[8],
    height: touchTarget.min - spacing[8],
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: color.accentSoft,
  },
  tabLabel: {
    fontSize: spacing[12] - 2,
    lineHeight: spacing[12] + 2,
    letterSpacing: 0.15,
  },
  itemPressed: {
    opacity: 0.75,
  },
});
