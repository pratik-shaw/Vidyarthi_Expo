import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  StatusBar,
  Animated,
  Platform,
  SafeAreaView,
  Image
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import React, { useEffect } from 'react';
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ColorValue } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const LoginScreen: React.FC<Props> = ({ navigation }) => {
  // Hide the header
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);
  
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const renderRoleCard = (
    title: string, 
    description: string,
    destination: 'Admin' | 'Student' | 'Teacher', 
    gradientColors: [string, string], 
    delay: number,
    icon: React.ReactNode
  ) => {
    const cardFade = new Animated.Value(0);
    const cardSlide = new Animated.Value(40);

    useEffect(() => {
      Animated.parallel([
        Animated.timing(cardFade, {
          toValue: 1,
          duration: 600,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(cardSlide, {
          toValue: 0,
          duration: 600,
          delay,
          useNativeDriver: true,
        })
      ]).start();
    }, []);

    return (
      <Animated.View 
        style={[
          styles.roleCardContainer, 
          { 
            opacity: cardFade, 
            transform: [{ translateY: cardSlide }],
          }
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.roleCard}
          onPress={() => navigation.navigate(destination)}
        >
          <LinearGradient
            colors={gradientColors as readonly [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.roleIconContainer}
          >
            {icon}
          </LinearGradient>
          
          <View style={styles.roleTextContainer}>
            <Text style={styles.roleTitle}>{title}</Text>
            <Text style={styles.roleDescription}>{description}</Text>
          </View>
          
          <View style={styles.roleArrowContainer}>
                          <LinearGradient
              colors={gradientColors as readonly [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.roleArrow}
            >
              <MaterialIcons name="arrow-forward" size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Hide the status bar completely */}
      <StatusBar hidden={true} />
      
      <View style={styles.container}>

        
        <View style={styles.header}>
          <Animated.View 
            style={[
              styles.logoContainer, 
              { 
                opacity: fadeAnim, 
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Image 
              source={require('../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Vidyarthi</Text>
          </Animated.View>
          
          <Animated.View 
            style={[
              styles.titleContainer,
              { 
                opacity: fadeAnim, 
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <Text style={styles.title}>Welcome to your</Text>
            <Text style={styles.subtitle}>Education Management System</Text>
          </Animated.View>
        </View>

        <View style={styles.content}>
          <View style={styles.selectionHeader}>
            <Text style={styles.selectionTitle}>Select your role</Text>
            <View style={styles.selectionDivider} />
          </View>
          
          {renderRoleCard(
            'Student', 
            'Access courses, assignments, and grades',
            'Student', 
            ['#4E54C8', '#8F94FB'], 
            300,
            <FontAwesome5 name="user-graduate" size={20} color="#FFFFFF" />
          )}
          
          {renderRoleCard(
            'Teacher', 
            'Manage classes, assignments, and student progress',
            'Teacher', 
            ['#1CB5E0', '#38EF7D'], 
            450,
            <FontAwesome5 name="chalkboard-teacher" size={20} color="#FFFFFF" />
          )}
          
          {renderRoleCard(
            'Administrator', 
            'Control system settings and user permissions',
            'Admin', 
            ['#3A4276', '#5B6286'], 
            600,
            <FontAwesome5 name="user-shield" size={20} color="#FFFFFF" />
          )}
        </View>

        <Animated.View style={[styles.footer, { opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.helpButton}>
            <Feather name="help-circle" size={16} color="#8A94A6" style={styles.helpIcon} />
            <Text style={styles.footerText}>Need help? Contact support</Text>
          </TouchableOpacity>
          <Text style={styles.version}>Version 2.4.1</Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FC',
    paddingHorizontal: 24,
    position: 'relative',
    overflow: 'hidden',
  },

  header: {
    paddingTop: 40,
    paddingBottom: 30,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  appName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A4276',
  },
  titleContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '300',
    color: '#3A4276',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#3A4276',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  selectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginRight: 12,
  },
  selectionDivider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(58, 66, 118, 0.1)',
  },
  roleCardContainer: {
    marginBottom: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  roleIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  roleTextContainer: {
    flex: 1,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  roleDescription: {
    fontSize: 14,
    color: '#8A94A6',
    lineHeight: 20,
  },
  roleArrowContainer: {
    marginLeft: 10,
  },
  roleArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(138, 148, 166, 0.1)',
    marginBottom: 5,
  },
  helpIcon: {
    marginRight: 6,
  },
  footer: {
    marginTop: 20,
    marginBottom: Platform.OS === 'ios' ? 30 : 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#8A94A6',
  },
  version: {
    fontSize: 12,
    color: '#B0B7C3',
    marginTop: 8,
  },
});

export default LoginScreen;